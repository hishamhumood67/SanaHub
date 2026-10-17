'use client'

import { memo, useMemo } from 'react'
import { RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { EV3, EV3_FRONT_Z, MS_DEVICES } from '../layouts'
import { makeLabelTexture } from './labelTexture'
import { MODEL_URLS, PartModel } from './PartLoader'

const PX = 90
const GREY = '#c5c8cd'
const DARK = '#2a2c31'
const WHITE = '#f0f1f3'
const mat = (color: string, extra: Partial<THREE.MeshPhysicalMaterialParameters> = {}) => (
  <meshPhysicalMaterial color={color} roughness={0.38} clearcoat={0.35} clearcoatRoughness={0.4} {...extra} />
)

function Brick() {
  const [w, h, d] = EV3.size
  const [cx, cy, cz] = EV3.pos
  const face = useMemo(
    () =>
      makeLabelTexture(w * PX, h * PX, (ctx, tw, th) => {
        const px = (x: number) => (x + w / 2) * PX
        const py = (y: number) => (h - y) * PX
        // screen
        ctx.fillStyle = '#17191d'
        ctx.fillRect(px(-2.3), py(4.8), 4.6 * PX, 2.4 * PX)
        ctx.fillStyle = '#a8b99a'
        ctx.fillRect(px(-2.05), py(4.55), 4.1 * PX, 1.9 * PX)
        ctx.fillStyle = '#26301f'
        ctx.font = '700 28px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('SANA HUB', px(0), py(3.6))
        // port labels
        ctx.fillStyle = '#20232a'
        ctx.font = '700 26px Arial, sans-serif'
        ;['A', 'B', 'C', 'D'].forEach((n, i) => ctx.fillText(n, px(-3.9 + i * 2.6), py(6.4)))
        ;['1', '2', '3', '4'].forEach((n, i) => ctx.fillText(n, px(-3.9 + i * 2.6), py(1.05)))
        void tw
        void th
      }),
    [w, h],
  )
  const ports = useMemo(
    () => [5.5, 1.9].flatMap((y) => [0, 1, 2, 3].map((i) => [-3.9 + i * 2.6, y] as const)),
    [],
  )
  return (
    <group>
      <RoundedBox args={[w, h, d]} radius={0.35} smoothness={5} position={[cx, cy, cz]} castShadow receiveShadow>
        {mat(GREY)}
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[cx + s * (w / 2 - 0.1), cy, cz]}>
          <boxGeometry args={[0.3, h - 0.9, d - 0.9]} />
          <meshStandardMaterial color="#4a4d54" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[cx, cy, EV3_FRONT_Z + 0.012]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={face} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      {ports.map(([x, y]) => (
        <RoundedBox key={`${x}-${y}`} args={[1.5, 1.1, 0.4]} radius={0.08} position={[x, y, EV3_FRONT_Z + 0.02]}>
          <meshStandardMaterial color={DARK} roughness={0.7} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Jack({ y }: { y: number }) {
  return (
    <mesh position={[0, y, 0]}>
      <boxGeometry args={[0.9, 0.3, 0.9]} />
      <meshStandardMaterial color={DARK} roughness={0.7} />
    </mesh>
  )
}

function Motor() {
  const { pos, size } = MS_DEVICES.motor
  return (
    <group position={pos}>
      <RoundedBox args={size} radius={0.3} smoothness={4} castShadow receiveShadow>
        {mat('#a3a8af')}
      </RoundedBox>
      <mesh position={[0, 0, size[2] / 2 + 0.25]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.95, 0.95, 0.5, 40]} />
        <meshStandardMaterial color="#3f4249" roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.52]}>
        <boxGeometry args={[0.45, 0.12, 0.05]} />
        <meshStandardMaterial color="#15171a" />
      </mesh>
      <mesh position={[0, 0, size[2] / 2 + 0.52]}>
        <boxGeometry args={[0.12, 0.45, 0.05]} />
        <meshStandardMaterial color="#15171a" />
      </mesh>
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, size[1] / 2 + 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 20]} />
          <meshStandardMaterial color="#202226" />
        </mesh>
      ))}
      <Jack y={size[1] / 2 + 0.1} />
    </group>
  )
}

function Ultrasonic() {
  const { pos, size } = MS_DEVICES.ultra
  return (
    <group position={pos}>
      <RoundedBox args={size} radius={0.3} smoothness={4} castShadow receiveShadow>
        {mat(WHITE, { roughness: 0.3 })}
      </RoundedBox>
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 0, size[2] / 2 + 0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[1, 1, 0.3, 40]} />
            <meshStandardMaterial color="#2a2d33" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <cylinderGeometry args={[0.72, 0.72, 0.02, 40]} />
            <meshPhysicalMaterial color="#060708" roughness={0.25} clearcoat={1} />
          </mesh>
        </group>
      ))}
      <Jack y={size[1] / 2 + 0.1} />
    </group>
  )
}

function Color() {
  const { pos, size } = MS_DEVICES.color
  return (
    <group position={pos}>
      <RoundedBox args={size} radius={0.28} smoothness={4} castShadow receiveShadow>
        {mat(WHITE, { roughness: 0.3 })}
      </RoundedBox>
      <mesh position={[0, -0.3, size[2] / 2 + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.65, 0.65, 0.12, 32]} />
        <meshPhysicalMaterial color="#14161a" roughness={0.2} clearcoat={1} />
      </mesh>
      {(['#ff3030', '#30ff6a', '#3a7bff'] as const).map((c, i) => (
        <mesh key={c} position={[(i - 1) * 0.55, 0.75, size[2] / 2 + 0.04]}>
          <sphereGeometry args={[0.14, 12, 12]} />
          <meshStandardMaterial color={c} emissive={c} emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      ))}
      <Jack y={size[1] / 2 + 0.1} />
    </group>
  )
}

function Mat() {
  const grid = useMemo(() => {
    const t = makeLabelTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#1e2229'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = '#2e3541'
      ctx.lineWidth = 2
      ctx.strokeRect(0, 0, w, h)
    })
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(15, 8)
    return t
  }, [])
  return (
    <mesh position={[0, -0.1, 1]} receiveShadow>
      <boxGeometry args={[30, 0.2, 16]} />
      <meshStandardMaterial map={grid} roughness={0.95} />
    </mesh>
  )
}

export const Ev3Brick = memo(() => <PartModel url={MODEL_URLS.ev3}><Brick /></PartModel>)
export const MediumMotor = memo(() => <PartModel url={MODEL_URLS.motor}><Motor /></PartModel>)
export const UltrasonicSensor = memo(() => <PartModel url={MODEL_URLS.ultra}><Ultrasonic /></PartModel>)
export const ColorSensor = memo(() => <PartModel url={MODEL_URLS.color}><Color /></PartModel>)
export const WorkMat = memo(Mat)
