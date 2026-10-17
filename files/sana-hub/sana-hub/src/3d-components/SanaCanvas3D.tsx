'use client'

import {
  forwardRef,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Environment, Html, OrbitControls, useCursor } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type * as THREE from 'three'
import { useLanguage } from '@/i18n/LanguageContext'
import type { DictKey } from '@/i18n/dictionaries'
import { PIN_BY_KEY, pinLabel, type PinDef, type PinKey } from '@/simulators/pinCatalog'
import type { LayoutId, Severity, Wire } from '@/simulators/circuitEvaluator'
import { LAYOUTS, PAD, layoutGeometry, layoutPins, type LayoutDef, type Vec3 } from './layouts'
import { useWireDrag, WireLayer } from './WireManager'
import { BreadboardModel } from './parts/BreadboardModel'
import { Esp32Model } from './parts/Esp32Model'
import { HcSr04Model } from './parts/HcSr04Model'
import { ColorSensor, Ev3Brick, MediumMotor, UltrasonicSensor, WorkMat } from './parts/MindstormsModels'

const COLORS = { hover: '#5cf2a8', wired: '#7cc4ff', error: '#E5534B', warning: '#D08A3C' }
type SnapshotFn = (maxWidth?: number) => string | null

/* ------------------------------------------------------------------ selectable pins */

interface PinMeshProps {
  def: PinDef
  pos: Vec3
  exit: Vec3
  hovered: boolean
  selected: boolean
  wired: boolean
  pulse: boolean
  flag?: Severity
  onDown: (key: PinKey, e: ThreeEvent<PointerEvent>) => void
  onEnter: (key: PinKey) => void
  onLeave: (key: PinKey) => void
}

const PinMesh = memo(function PinMesh({ def, pos, exit, hovered, selected, wired, pulse, flag, onDown, onEnter, onLeave }: PinMeshProps) {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  useCursor(hovered)
  useFrame(({ clock }) => {
    if (pulse && mat.current) mat.current.emissiveIntensity = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 7)
  })

  const pad = PAD[def.part]
  const onBoard = def.part === 'esp32' || def.part === 'hcsr04'
  const color = selected ? '#ffffff' : hovered ? COLORS.hover : wired ? COLORS.wired : pad.color
  const rotation: Vec3 = exit[2] === 1 ? [Math.PI / 2, 0, 0] : [0, 0, 0] // sockets on the front face point at the camera
  const legBottom = -0.25
  const legH = pos[1] - 0.05 - legBottom

  return (
    <group position={pos}>
      {onBoard && (
        <mesh position={[0, legBottom + legH / 2 - pos[1], 0]}>
          <cylinderGeometry args={[0.03, 0.03, legH, 8]} />
          <meshStandardMaterial color="#c9c9c9" metalness={1} roughness={0.35} />
        </mesh>
      )}
      <mesh rotation={rotation}>
        <cylinderGeometry args={[pad.r, pad.r, 0.1, 24]} />
        <meshStandardMaterial
          ref={mat}
          color={color}
          metalness={onBoard ? 1 : 0.2}
          roughness={onBoard ? 0.22 : 0.5}
          emissive={pulse ? '#ffffff' : color}
          emissiveIntensity={pulse ? 0.8 : hovered || selected ? 0.55 : 0}
        />
      </mesh>
      {flag && (
        <mesh rotation={[rotation[0] + Math.PI / 2, 0, 0]}>
          <torusGeometry args={[pad.r * 1.75, Math.max(0.025, pad.r * 0.18), 8, 28]} />
          <meshBasicMaterial color={flag === 'error' ? COLORS.error : COLORS.warning} toneMapped={false} />
        </mesh>
      )}
      {/* invisible, generous hit target */}
      <mesh
        onPointerDown={(e) => onDown(def.key, e)}
        onPointerOver={(e) => {
          e.stopPropagation()
          onEnter(def.key)
        }}
        onPointerOut={() => onLeave(def.key)}
      >
        <sphereGeometry args={[pad.hit, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
})

/* ------------------------------------------------------------------ scene */

interface SceneProps {
  layout: LayoutDef
  wires: Wire[]
  selected: PinKey | null
  hover: PinKey | null
  highlight: PinKey[]
  flagged: Partial<Record<PinKey, Severity>>
  partLabels: Record<string, string>
  dir: 'ltr' | 'rtl'
  controlsRef: MutableRefObject<OrbitControlsImpl | null>
  captureRef: MutableRefObject<SnapshotFn>
  onHoverStart: (k: PinKey) => void
  onHoverEnd: (k: PinKey) => void
  onSelect: (k: PinKey | null) => void
  onAddWire: (a: PinKey, b: PinKey) => void
  onRemoveWire: (id: string) => void
}

const Scene = memo(function Scene(p: SceneProps) {
  const { layout, controlsRef, captureRef } = p
  const pins = useMemo(() => layoutPins(layout.id), [layout.id])
  const { pos, exit } = useMemo(() => layoutGeometry(layout.id), [layout.id])
  const { gl, scene, camera } = useThree()

  const drag = useWireDrag({
    pinPos: pos,
    exit,
    style: layout.wire,
    controlsRef,
    onConnect: p.onAddWire,
    onClickPin: p.onSelect,
  })

  // Lets the page grab a thumbnail of exactly what the user sees (used by "Share to Community Hub").
  useEffect(() => {
    captureRef.current = (maxWidth = 640) => {
      gl.render(scene, camera)
      const src = gl.domElement
      const scale = Math.min(1, maxWidth / src.width)
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(src.width * scale))
      out.height = Math.max(1, Math.round(src.height * scale))
      const ctx = out.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(src, 0, 0, out.width, out.height)
      return out.toDataURL('image/jpeg', 0.82)
    }
    return () => {
      captureRef.current = () => null
    }
  }, [gl, scene, camera, captureRef])

  useEffect(() => {
    controlsRef.current?.saveState() // so "Reset view" returns to the layout's starting camera
  }, [controlsRef, layout.id])

  const wired = useMemo(() => new Set(p.wires.flatMap((w) => [w.a, w.b])), [p.wires])
  const lit = useMemo(() => new Set(p.highlight), [p.highlight])

  return (
    <>
      <color attach="background" args={['#0b1624']} />

      {/* Studio lighting: image-based "city" reflections + one soft key light + faint fill */}
      <Suspense fallback={null}>
        <Environment preset="city" background={false} environmentIntensity={0.85} />
      </Suspense>
      <hemisphereLight args={['#dfe9f5', '#0b1624', 0.25]} />
      <directionalLight
        position={[6, 12, 8]}
        intensity={1.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />

      {layout.id === 'esp32-hcsr04' ? (
        <>
          <BreadboardModel />
          <Esp32Model />
          <HcSr04Model />
          <ContactShadows position={[0, -0.91, 0]} opacity={0.55} scale={30} blur={2.4} far={4} />
        </>
      ) : (
        <>
          <WorkMat />
          <Ev3Brick />
          <MediumMotor />
          <UltrasonicSensor />
          <ColorSensor />
          <ContactShadows position={[0, 0.01, 1]} opacity={0.5} scale={40} blur={2.6} far={6} />
        </>
      )}

      {pins.map((def) => (
        <PinMesh
          key={def.key}
          def={def}
          pos={pos[def.key]}
          exit={exit[def.key]}
          hovered={p.hover === def.key}
          selected={p.selected === def.key}
          wired={wired.has(def.key)}
          pulse={lit.has(def.key)}
          flag={p.flagged[def.key]}
          onDown={drag.begin}
          onEnter={p.onHoverStart}
          onLeave={p.onHoverEnd}
        />
      ))}

      <WireLayer
        wires={p.wires}
        pinPos={pos}
        exit={exit}
        style={layout.wire}
        from={drag.from}
        snap={drag.snap}
        hover={p.hover}
        preview={drag.preview}
        onRemove={p.onRemoveWire}
      />

      {/* Part names: plain strings in, so no React context is needed across the canvas boundary */}
      {layout.labels.map((l) => (
        <Html key={l.part} position={l.at} center zIndexRange={[10, 0]} pointerEvents="none">
          <div dir={p.dir} className="whitespace-nowrap rounded bg-ink/80 px-2 py-0.5 text-xs text-mist">
            {p.partLabels[l.part]}
          </div>
        </Html>
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        target={layout.target}
        minDistance={5}
        maxDistance={45}
        maxPolarAngle={Math.PI / 2 - 0.05}
      />
    </>
  )
})

/* ------------------------------------------------------------------ public component */

export interface SanaCanvas3DHandle {
  /** JPEG data URL of the current view (for the community thumbnail), or null if WebGL is not ready */
  snapshot: (maxWidth?: number) => string | null
  resetView: () => void
}

export interface SanaCanvas3DProps {
  layoutId: LayoutId
  /** controlled wires (optional: the canvas keeps its own state otherwise) */
  wires?: Wire[]
  onWiresChange?: (wires: Wire[]) => void
  /** rings drawn around pins, e.g. from the circuit evaluator */
  flaggedPins?: Partial<Record<PinKey, Severity>>
  /** pins that pulse, e.g. when SANA AI says "show on board" */
  highlightPins?: PinKey[]
  onPinSelect?: (pin: PinKey | null) => void
  className?: string
}

const NO_FLAGS: Partial<Record<PinKey, Severity>> = {}
const NO_PINS: PinKey[] = []

const SanaCanvas3D = forwardRef<SanaCanvas3DHandle, SanaCanvas3DProps>(function SanaCanvas3D(
  { layoutId, wires: wiresProp, onWiresChange, flaggedPins = NO_FLAGS, highlightPins = NO_PINS, onPinSelect, className = '' },
  ref,
) {
  const { t, pick, dir } = useLanguage()
  const layout = LAYOUTS[layoutId]

  const [innerWires, setInnerWires] = useState<Wire[]>([])
  const wires = wiresProp ?? innerWires
  const wiresRef = useRef(wires)
  wiresRef.current = wires

  const [hover, setHover] = useState<PinKey | null>(null)
  const [selected, setSelected] = useState<PinKey | null>(null)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const captureRef = useRef<SnapshotFn>(() => null)
  const boxRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({ snapshot: (w) => captureRef.current(w), resetView: () => controlsRef.current?.reset() }),
    [],
  )

  useEffect(() => {
    setSelected(null)
    setHover(null)
  }, [layoutId])

  const commit = useCallback(
    (next: Wire[]) => {
      setInnerWires(next)
      onWiresChange?.(next)
    },
    [onWiresChange],
  )
  const addWire = useCallback(
    (a: PinKey, b: PinKey) => {
      const cur = wiresRef.current
      if (cur.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a))) return
      const id = `w${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      commit([...cur, { id, a, b }])
    },
    [commit],
  )
  const removeWire = useCallback((id: string) => commit(wiresRef.current.filter((w) => w.id !== id)), [commit])
  const select = useCallback(
    (k: PinKey | null) => {
      setSelected(k)
      onPinSelect?.(k)
    },
    [onPinSelect],
  )
  const hoverStart = useCallback((k: PinKey) => setHover(k), [])
  const hoverEnd = useCallback((k: PinKey) => setHover((h) => (h === k ? null : h)), [])

  // Tooltip follows the mouse without re-rendering React on every move
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const tip = tipRef.current
    const box = boxRef.current
    if (!tip || !box) return
    const r = box.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const flip = x > r.width - tip.offsetWidth - 24
    tip.style.transform = `translate(${flip ? x - 16 - tip.offsetWidth : x + 16}px, ${y + 16}px)`
  }

  const partLabels = useMemo(
    () => ({
      esp32: t('part.esp32'),
      hcsr04: t('part.hcsr04'),
      ev3: t('part.ev3'),
      motor: t('part.motor'),
      ultra: t('part.ultra'),
      color: t('part.color'),
    }),
    [t],
  )

  const hoverDef = hover ? PIN_BY_KEY[hover] : null
  const selDef = selected ? PIN_BY_KEY[selected] : null
  const selLinks = selected
    ? wires.filter((w) => w.a === selected || w.b === selected).map((w) => (w.a === selected ? w.b : w.a))
    : []
  const kindLabel = (d: PinDef) => t(`kind.${d.kind}` as DictKey)

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      className={`relative h-full min-h-[420px] w-full touch-none select-none overflow-hidden rounded-2xl bg-ink ${className}`}
    >
      <Canvas
        key={layoutId}
        shadows
        camera={{ position: layout.camera, fov: 36, near: 0.1, far: 120 }}
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onPointerMissed={() => select(null)}
        aria-label={t(`layout.${layoutId}` as DictKey)}
      >
        <Scene
          layout={layout}
          wires={wires}
          selected={selected}
          hover={hover}
          highlight={highlightPins}
          flagged={flaggedPins}
          partLabels={partLabels}
          dir={dir}
          controlsRef={controlsRef}
          captureRef={captureRef}
          onHoverStart={hoverStart}
          onHoverEnd={hoverEnd}
          onSelect={select}
          onAddWire={addWire}
          onRemoveWire={removeWire}
        />
      </Canvas>

      {/* hover tooltip */}
      <div
        ref={tipRef}
        className={`pointer-events-none absolute left-0 top-0 z-20 rounded-lg bg-ink/95 px-3 py-2 text-xs text-mist shadow-lg ring-1 ring-white/10 ${hoverDef ? 'visible' : 'invisible'}`}
      >
        {hoverDef && (
          <>
            <div className="font-semibold text-white">{pinLabel(hoverDef.key)}</div>
            <div className="text-mist/80">{kindLabel(hoverDef)}</div>
          </>
        )}
      </div>

      {/* pin inspector: start-3 flips to the right edge in Arabic */}
      <aside className="absolute start-3 top-3 z-10 w-64 max-w-[calc(100%-1.5rem)] rounded-xl bg-ink2/90 p-3 text-sm text-mist ring-1 ring-white/10 backdrop-blur">
        <h2 className="mb-2 text-xs font-medium text-mist/70">{t('canvas.inspector')}</h2>
        {selDef ? (
          <div className="space-y-2">
            <div>
              <div className="text-base font-semibold text-white">{pinLabel(selDef.key)}</div>
              <div className="text-xs text-mist/70">{t(`part.${selDef.part}` as DictKey)}</div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-mist/60">{t('canvas.kind')}</dt>
              <dd>{kindLabel(selDef)}</dd>
              <dt className="text-mist/60">{t('canvas.level')}</dt>
              <dd dir="ltr" className="text-start">{selDef.level}</dd>
              {selDef.caps.length > 0 && (
                <>
                  <dt className="text-mist/60">{t('canvas.caps')}</dt>
                  <dd dir="ltr" className="text-start">{selDef.caps.join(' · ')}</dd>
                </>
              )}
              <dt className="text-mist/60">{t('canvas.connected')}</dt>
              <dd>{selLinks.length ? selLinks.map(pinLabel).join(', ') : t('canvas.notConnected')}</dd>
            </dl>
            <p className="text-xs leading-relaxed text-mist/90">{pick(selDef.note)}</p>
          </div>
        ) : (
          <p className="text-xs text-mist/80">{t('canvas.pickPin')}</p>
        )}
      </aside>

      {/* toolbar */}
      <div className="absolute end-3 top-3 z-10 flex items-center gap-2">
        <span className="rounded-full bg-ink2/90 px-3 py-1 text-xs text-mist ring-1 ring-white/10">
          {t('canvas.wires', { n: wires.length })}
        </span>
        <button
          type="button"
          onClick={() => controlsRef.current?.reset()}
          className="rounded-full bg-ink2/90 px-3 py-1 text-xs text-mist ring-1 ring-white/10 hover:bg-ink3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
        >
          {t('canvas.reset')}
        </button>
        <button
          type="button"
          onClick={() => commit([])}
          disabled={wires.length === 0}
          className="rounded-full bg-ink2/90 px-3 py-1 text-xs text-mist ring-1 ring-white/10 hover:bg-ink3 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
        >
          {t('canvas.clear')}
        </button>
      </div>

      <p className="pointer-events-none absolute inset-x-3 bottom-3 z-10 text-center text-xs text-mist/70">
        {t('canvas.hint')}
      </p>
    </div>
  )
})

export default SanaCanvas3D
