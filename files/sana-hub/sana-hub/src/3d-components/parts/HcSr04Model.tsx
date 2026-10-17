'use client'

import { memo, useMemo } from 'react'
import { SENSOR } from '../layouts'
import { makeLabelTexture } from './labelTexture'
import { MODEL_URLS, PartModel } from './PartLoader'

const W = 4.5
const H = 2
const PX = 200
const PIN_NAMES = ['VCC', 'TRIG', 'ECHO', 'GND']

function Procedural() {
  const { cx, z, pitch } = SENSOR
  const silk = useMemo(
    () =>
      makeLabelTexture(W * PX, H * PX, (ctx, w, h) => {
        ctx.fillStyle = '#eef4fb'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '700 20px Arial, sans-serif'
        ctx.fillText('HC-SR04', w / 2, 90)
        ctx.font = '700 15px Arial, sans-serif'
        PIN_NAMES.forEach((n, i) => ctx.fillText(n, w / 2 + (i - 1.5) * pitch * PX, h - 14))
      }),
    [pitch],
  )

  return (
    <group>
      <mesh position={[cx, 1.5, z]} castShadow receiveShadow>
        <boxGeometry args={[W, H, 0.16]} />
        <meshPhysicalMaterial color="#1d5ea8" roughness={0.5} clearcoat={0.5} clearcoatRoughness={0.4} />
      </mesh>
      <mesh position={[cx, 1.5, z + 0.081]}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={silk} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {/* black pin-header base */}
      <mesh position={[cx, 0.42, z]}>
        <boxGeometry args={[2.2, 0.16, 0.3]} />
        <meshStandardMaterial color="#0c0d0f" roughness={0.6} />
      </mesh>
      {/* the two ultrasonic transducers (the "eyes") */}
      {[-1.3, 1.3].map((dx) => (
        <group key={dx} position={[cx + dx, 1.5, z + 0.58]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.8, 0.8, 1, 48]} />
            <meshStandardMaterial color="#aab2bb" metalness={1} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.505, 0]}>
            <cylinderGeometry args={[0.62, 0.62, 0.02, 48]} />
            <meshStandardMaterial color="#101214" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.512, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.45, 0.02, 8, 40]} />
            <meshStandardMaterial color="#3a3f46" metalness={0.8} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {/* crystal */}
      <mesh position={[cx, 1.55, z + 0.15]}>
        <boxGeometry args={[0.55, 0.22, 0.14]} />
        <meshStandardMaterial color="#c9ced4" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  )
}

export const HcSr04Model = memo(function HcSr04Model() {
  return (
    <PartModel url={MODEL_URLS.hcsr04}>
      <Procedural />
    </PartModel>
  )
})
