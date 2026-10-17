'use client'

import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { HOLE_X0, PITCH } from '../layouts'
import { makeLabelTexture } from './labelTexture'

const W = 17
const D = 5.5
const PX = 120

export const BreadboardModel = memo(function BreadboardModel() {
  const holes = useRef<THREE.InstancedMesh>(null)

  const matrices = useMemo(() => {
    const dummy = new THREE.Object3D()
    const out: THREE.Matrix4[] = []
    const push = (x: number, z: number) => {
      dummy.position.set(x, 0.012, z)
      dummy.updateMatrix()
      out.push(dummy.matrix.clone())
    }
    for (let k = 0; k < 60; k++) {
      for (let j = 0; j < 5; j++) {
        const z = 0.762 + j * PITCH
        push(HOLE_X0 + k * PITCH, z)
        push(HOLE_X0 + k * PITCH, -z)
      }
    }
    for (let k = 1; k < 58; k++) {
      if ((k + 1) % 6 === 0) continue // gap every 5 holes, like a real power rail
      for (const z of [2.05, 2.3, -2.05, -2.3]) push(HOLE_X0 + k * PITCH, z)
    }
    return out
  }, [])

  useLayoutEffect(() => {
    const mesh = holes.current
    if (!mesh) return
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m))
    mesh.instanceMatrix.needsUpdate = true
  }, [matrices])

  // channel, power-rail stripes and column numbers, printed like a real board
  const print = useMemo(
    () =>
      makeLabelTexture(W * PX, D * PX, (ctx, w, h) => {
        const zPx = (z: number) => (z + D / 2) * PX
        ctx.fillStyle = '#bdb8a9'
        ctx.fillRect(0, zPx(-0.38), w, 0.76 * PX)
        ctx.fillStyle = '#c43b3b'
        ctx.fillRect(0.4 * PX, zPx(-2.6), w - 0.8 * PX, 5)
        ctx.fillStyle = '#3a64c4'
        ctx.fillRect(0.4 * PX, zPx(2.6), w - 0.8 * PX, 5)
        ctx.fillStyle = '#8a8579'
        ctx.font = '600 15px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        for (let k = 0; k < 60; k++) {
          if (k !== 0 && (k + 1) % 5 !== 0) continue
          const x = (HOLE_X0 + k * PITCH + W / 2) * PX
          ctx.fillText(String(k + 1), x, zPx(-1.95))
          ctx.fillText(String(k + 1), x, zPx(1.95))
        }
        ctx.font = '700 18px Arial, sans-serif'
        ctx.fillStyle = '#c43b3b'
        ctx.fillText('+', 0.2 * PX, zPx(-2.3))
        ctx.fillStyle = '#3a64c4'
        ctx.fillText('−', 0.2 * PX, zPx(2.3))
        void h
      }),
    [],
  )

  return (
    <group>
      <RoundedBox args={[W, 0.9, D]} radius={0.12} smoothness={4} position={[0, -0.45, 0]} receiveShadow castShadow>
        <meshPhysicalMaterial color="#ebe7db" roughness={0.55} clearcoat={0.25} clearcoatRoughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.0035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial map={print} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <instancedMesh ref={holes} args={[undefined, undefined, matrices.length]} frustumCulled={false}>
        <boxGeometry args={[0.1, 0.02, 0.1]} />
        <meshStandardMaterial color="#1c1b19" roughness={0.9} />
      </instancedMesh>
    </group>
  )
})
