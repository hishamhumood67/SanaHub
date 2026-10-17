'use client'

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Billboard, useCursor } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { PIN_BY_KEY, type PinKey } from '@/simulators/pinCatalog'
import type { Wire } from '@/simulators/circuitEvaluator'
import { PAD, type Vec3, type WireStyle } from './layouts'

/** How close (in screen pixels) the cursor must get to a pin before the wire snaps to it. */
export const SNAP_PX = 34
/** Wires never dip below this height, so they rest on the board instead of passing through it. */
export const FLOOR_Y = 0.12
const TUBE_SEGMENTS = 48
const TUBE_SIDES = 8
const PREVIEW_POINTS = 28
const SETTLE_SECONDS = 1.4

const NO_RAYCAST: THREE.Object3D['raycast'] = () => {}
const MESH_RAYCAST = THREE.Mesh.prototype.raycast

/* ---------------------------------------------------------------------------------------
 * 1. Curve math
 * ------------------------------------------------------------------------------------- */

/**
 * Builds the centre line of a wire as a CatmullRomCurve3 (a smooth spline through control points).
 *
 *   A ──exit──▶ A'  ·  m25  ·  m50  ·  m75  ·  B' ◀──exit── B
 *
 * A' and B' are the points where the wire has left each pin (straight out along the pin's exit
 * direction). The three middle points sit on the chord A'→B', pushed vertically by a parabola
 * 4·t·(1−t), which is 0 at the ends and 1 in the middle:
 *   - 'arch'  (jumper wire)   pushes UP  by length × amount
 *   - 'droop' (EV3 cable)     pushes DOWN by length × amount, clamped at FLOOR_Y
 * `settle` (−1…+1) scales that offset so the wire can bounce when it is first placed.
 */
export function buildWireCurve(
  a: Vec3,
  b: Vec3,
  exitA: Vec3,
  exitB: Vec3,
  style: WireStyle,
  settle = 0,
): THREE.CatmullRomCurve3 {
  const A = new THREE.Vector3(...a)
  const B = new THREE.Vector3(...b)
  const A2 = A.clone().addScaledVector(new THREE.Vector3(...exitA), style.exit)
  const B2 = B.clone().addScaledVector(new THREE.Vector3(...exitB), style.exit)
  const direction = style.mode === 'arch' ? 1 : -1
  const offset = A2.distanceTo(B2) * style.amount * (1 + settle) * direction
  const middle = [0.25, 0.5, 0.75].map((t) => {
    const p = A2.clone().lerp(B2, t)
    p.y = Math.max(FLOOR_Y, p.y + offset * 4 * t * (1 - t))
    return p
  })
  return new THREE.CatmullRomCurve3([A, A2, ...middle, B2, B], false, 'catmullrom', 0.5)
}

/** Damped spring: starts at +0.9, overshoots, and reaches 0 after about a second. */
export const settleOffset = (t: number) => 0.9 * Math.exp(-4.2 * t) * Math.cos(13 * t)

export function wireColor(w: Wire): string {
  const a = PIN_BY_KEY[w.a]
  const b = PIN_BY_KEY[w.b]
  const kinds = [a?.kind, b?.kind]
  if (kinds.includes('gnd')) return '#202127'
  if (w.a === 'esp32:3V3' || w.b === 'esp32:3V3') return '#e8833a'
  if (kinds.includes('power')) return '#d64545'
  if (kinds.includes('sensor-in')) return '#f2c744'
  if (kinds.includes('sensor-out')) return '#4aa3ff'
  return '#3cc47c'
}

/* ---------------------------------------------------------------------------------------
 * 2. Drag state machine: press a pin, drag, snap to the nearest pin, release to connect
 * ------------------------------------------------------------------------------------- */

interface DragOptions {
  pinPos: Record<PinKey, Vec3>
  exit: Record<PinKey, Vec3>
  style: WireStyle
  controlsRef: MutableRefObject<OrbitControlsImpl | null>
  onConnect: (a: PinKey, b: PinKey) => void
  /** a press-and-release on the same pin without dragging */
  onClickPin: (pin: PinKey) => void
}

export function useWireDrag({ pinPos, exit, style, controlsRef, onConnect, onClickPin }: DragOptions) {
  const { camera, raycaster, pointer, size } = useThree()
  const [from, setFrom] = useState<PinKey | null>(null)
  const [snap, setSnap] = useState<PinKey | null>(null)
  // refs mirror the state so the window listener and the render loop never read stale values
  const fromRef = useRef<PinKey | null>(null)
  const snapRef = useRef<PinKey | null>(null)
  const start = useRef({ x: 0, y: 0 })
  const callbacks = useRef({ onConnect, onClickPin })
  callbacks.current = { onConnect, onClickPin }

  const keys = useMemo(() => Object.keys(pinPos) as PinKey[], [pinPos])
  const plane = useMemo(() => new THREE.Plane(), [])
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), hit: new THREE.Vector3(), dir: new THREE.Vector3() }), [])

  // The live preview wire: one THREE.Line whose vertices are rewritten every frame.
  const preview = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PREVIEW_POINTS * 3), 3))
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#3dffa8', toneMapped: false }))
    line.frustumCulled = false
    line.visible = false
    return line
  }, [])
  useEffect(
    () => () => {
      preview.geometry.dispose()
      ;(preview.material as THREE.Material).dispose()
    },
    [preview],
  )

  const begin = useCallback(
    (pin: PinKey, e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation()
      fromRef.current = pin
      setFrom(pin)
      start.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
      if (controlsRef.current) controlsRef.current.enabled = false // stop the camera from orbiting
    },
    [controlsRef],
  )

  // Release anywhere (even outside the canvas) finishes the gesture.
  useEffect(() => {
    const end = (e: PointerEvent) => {
      const f = fromRef.current
      if (!f) return
      const s = snapRef.current
      fromRef.current = null
      snapRef.current = null
      setFrom(null)
      setSnap(null)
      if (controlsRef.current) controlsRef.current.enabled = true
      const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y)
      if (s && s !== f) callbacks.current.onConnect(f, s)
      else if (moved < 6) callbacks.current.onClickPin(f)
    }
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
    return () => {
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
    }
  }, [controlsRef])

  useFrame(() => {
    const f = fromRef.current
    preview.visible = !!f
    if (!f) return

    // (a) Snap: project every pin to the screen and take the nearest one within SNAP_PX.
    let best: PinKey | null = null
    let bestDist = SNAP_PX
    for (const k of keys) {
      if (k === f) continue
      tmp.v.set(...pinPos[k]).project(camera)
      if (tmp.v.z > 1) continue // behind the camera
      const d = Math.hypot(((tmp.v.x - pointer.x) * size.width) / 2, ((tmp.v.y - pointer.y) * size.height) / 2)
      if (d < bestDist) {
        bestDist = d
        best = k
      }
    }
    if (best !== snapRef.current) {
      snapRef.current = best
      setSnap(best)
    }

    // (b) Free end: where the mouse ray hits a plane that faces the camera and passes through the source pin.
    let end: Vec3
    if (best) {
      end = pinPos[best]
    } else {
      camera.getWorldDirection(tmp.dir)
      plane.setFromNormalAndCoplanarPoint(tmp.dir, tmp.v.set(...pinPos[f]))
      raycaster.setFromCamera(pointer, camera)
      end = raycaster.ray.intersectPlane(plane, tmp.hit) ? [tmp.hit.x, tmp.hit.y, tmp.hit.z] : pinPos[f]
    }

    // (c) Draw it with the same sagging curve the final wire will have.
    const curve = buildWireCurve(pinPos[f], end, exit[f], best ? exit[best] : [0, 1, 0], style, 0)
    const pts = curve.getPoints(PREVIEW_POINTS - 1)
    const attr = preview.geometry.getAttribute('position') as THREE.BufferAttribute
    pts.forEach((p, i) => attr.setXYZ(i, p.x, p.y, p.z))
    attr.needsUpdate = true
  })

  return { from, snap, preview, begin }
}

/* ---------------------------------------------------------------------------------------
 * 3. Rendering: wires and glowing snap targets
 * ------------------------------------------------------------------------------------- */

function SnapTarget({ position, active, radius }: { position: Vec3; active: boolean; radius: number }) {
  const group = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (active && group.current) group.current.scale.setScalar(1 + 0.18 * Math.sin(clock.elapsedTime * 9))
  })
  const color = active ? '#3dffa8' : '#8ff5cf'
  const common = {
    transparent: true,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  } as const
  return (
    <group position={position}>
      <Billboard>
        <group ref={group} renderOrder={20}>
          <mesh>
            <ringGeometry args={[radius * 0.75, radius, 32]} />
            <meshBasicMaterial color={color} opacity={active ? 1 : 0.4} {...common} />
          </mesh>
          <mesh>
            <circleGeometry args={[radius * 1.9, 32]} />
            <meshBasicMaterial color={color} opacity={active ? 0.3 : 0.08} {...common} />
          </mesh>
        </group>
      </Billboard>
    </group>
  )
}

interface WireMeshProps {
  wire: Wire
  pinPos: Record<PinKey, Vec3>
  exit: Record<PinKey, Vec3>
  style: WireStyle
  locked: boolean
  onRemove: (id: string) => void
}

const WireMesh = memo(function WireMesh({ wire, pinPos, exit, style, locked, onRemove }: WireMeshProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const born = useRef<number | null>(null)
  const settled = useRef(false)
  const [hot, setHot] = useState(false)
  useCursor(hot && !locked)

  const A = pinPos[wire.a]
  const B = pinPos[wire.b]
  const color = style.color ?? wireColor(wire)

  const rebuild = useCallback(
    (settle: number) => {
      const m = mesh.current
      if (!m) return
      m.geometry.dispose()
      const curve = buildWireCurve(A, B, exit[wire.a], exit[wire.b], style, settle)
      m.geometry = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, style.radius, TUBE_SIDES, false)
    },
    [A, B, exit, style, wire.a, wire.b],
  )

  // Start every (re)built wire at the top of the bounce, then let useFrame settle it.
  useLayoutEffect(() => {
    const m = mesh.current
    born.current = null
    settled.current = false
    rebuild(settleOffset(0))
    return () => m?.geometry.dispose()
  }, [rebuild])

  useFrame(({ clock }) => {
    if (settled.current) return
    if (born.current === null) born.current = clock.elapsedTime
    const t = clock.elapsedTime - born.current
    if (t >= SETTLE_SECONDS) {
      rebuild(0)
      settled.current = true
    } else {
      rebuild(settleOffset(t))
    }
  })

  const plug = (p: Vec3) => (
    <mesh position={p}>
      <cylinderGeometry args={[style.radius * 1.8, style.radius * 1.8, 0.14, 14]} />
      <meshStandardMaterial color="#15161a" roughness={0.6} />
    </mesh>
  )

  return (
    <group>
      <mesh
        ref={mesh}
        castShadow
        raycast={locked ? NO_RAYCAST : MESH_RAYCAST}
        onPointerOver={() => setHot(true)}
        onPointerOut={() => setHot(false)}
        onDoubleClick={(e) => {
          e.stopPropagation()
          onRemove(wire.id)
        }}
        onContextMenu={(e) => {
          e.stopPropagation()
          e.nativeEvent.preventDefault()
          onRemove(wire.id)
        }}
      >
        <meshPhysicalMaterial
          color={color}
          roughness={0.4}
          clearcoat={0.5}
          clearcoatRoughness={0.3}
          emissive={hot ? color : '#000000'}
          emissiveIntensity={hot ? 0.5 : 0}
        />
      </mesh>
      {plug(A)}
      {plug(B)}
    </group>
  )
})

export interface WireLayerProps {
  wires: Wire[]
  pinPos: Record<PinKey, Vec3>
  exit: Record<PinKey, Vec3>
  style: WireStyle
  from: PinKey | null
  snap: PinKey | null
  hover: PinKey | null
  preview: THREE.Line
  onRemove: (id: string) => void
}

/** Everything wire-related that lives inside <Canvas>: placed wires, the live preview, snap targets. */
export const WireLayer = memo(function WireLayer(p: WireLayerProps) {
  const dragging = p.from !== null
  const targets = useMemo(
    () => (dragging ? (Object.keys(p.pinPos) as PinKey[]).filter((k) => k !== p.from) : []),
    [dragging, p.from, p.pinPos],
  )
  const radius = (k: PinKey) => PAD[PIN_BY_KEY[k].part].hit * 1.25

  return (
    <>
      {p.wires.map((w) => (
        <WireMesh key={w.id} wire={w} pinPos={p.pinPos} exit={p.exit} style={p.style} locked={dragging} onRemove={p.onRemove} />
      ))}
      <primitive object={p.preview} />

      {targets.map((k) => (
        <SnapTarget key={k} position={p.pinPos[k]} active={k === p.snap} radius={radius(k)} />
      ))}
      {!dragging && p.hover && <SnapTarget position={p.pinPos[p.hover]} active radius={radius(p.hover)} />}
      {p.snap && <pointLight position={p.pinPos[p.snap]} color="#3dffa8" intensity={1.4} distance={3} />}
    </>
  )
})
