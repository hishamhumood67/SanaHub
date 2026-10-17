'use client'

import { memo, useMemo } from 'react'
import { ESP_CX, ESP_PIN_X0, PITCH } from '../layouts'
import { PINS } from '@/simulators/pinCatalog'
import { makeLabelTexture } from './labelTexture'
import { MODEL_URLS, PartModel } from './PartLoader'

const PCB = { w: 5.44, h: 0.16, d: 2.83, y: 0.58 }
const PX = 200
const TOP = PCB.y + PCB.h / 2

function Procedural() {
  const silk = useMemo(
    () =>
      makeLabelTexture(Math.round(PCB.w * PX), Math.round(PCB.d * PX), (ctx, w, h) => {
        const left = ESP_CX - PCB.w / 2
        ctx.fillStyle = '#e9edf2'
        ctx.font = '600 17px Arial, sans-serif'
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'
        for (const p of PINS) {
          if (p.part !== 'esp32') continue
          const x = (ESP_PIN_X0 + p.index * PITCH - left) * PX
          ctx.save()
          if (p.row === 'back') {
            ctx.translate(x, 38)
            ctx.rotate(Math.PI / 2)
          } else {
            ctx.translate(x, h - 38)
            ctx.rotate(-Math.PI / 2)
          }
          ctx.fillText(p.name, 0, 0)
          ctx.restore()
        }
        ctx.font = '700 22px Arial, sans-serif'
        ctx.fillText('ESP32 DEVKIT V1', w * 0.2, h / 2)
        ctx.font = '600 13px Arial, sans-serif'
        ctx.fillText('EN', 140, (-0.55 + PCB.d / 2) * PX)
        ctx.fillText('BOOT', 140, (0.55 + PCB.d / 2) * PX)
      }),
    [],
  )

  const moduleTex = useMemo(
    () =>
      makeLabelTexture(510, 360, (ctx, w, h) => {
        ctx.fillStyle = '#3c4148'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '700 30px Arial, sans-serif'
        ctx.fillText('ESP-WROOM-32', w / 2, h / 2 - 20)
        ctx.font = '500 16px Arial, sans-serif'
        ctx.fillText('Espressif · 2.4 GHz Wi-Fi + BT', w / 2, h / 2 + 22)
      }),
    [],
  )

  const passives = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        x: -6.3 + (i % 7) * 0.27,
        z: (i < 7 ? -0.62 : 0.62) + (((i * 37) % 5) - 2) * 0.04,
        cap: i % 3 === 0,
      })),
    [],
  )

  return (
    <group>
      <mesh position={[ESP_CX, PCB.y, 0]} castShadow receiveShadow>
        <boxGeometry args={[PCB.w, PCB.h, PCB.d]} />
        <meshPhysicalMaterial color="#0d1218" roughness={0.45} clearcoat={0.6} clearcoatRoughness={0.35} />
      </mesh>
      <mesh position={[ESP_CX, TOP + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[PCB.w, PCB.d]} />
        <meshBasicMaterial map={silk} transparent toneMapped={false} depthWrite={false} />
      </mesh>

      {/* RF shield can */}
      <mesh position={[-3.35, TOP + 0.16, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 0.32, 1.8]} />
        <meshStandardMaterial color="#cfd5db" metalness={1} roughness={0.28} />
      </mesh>
      <mesh position={[-3.35, TOP + 0.321, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.55, 1.8]} />
        <meshBasicMaterial map={moduleTex} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh position={[-2.38, TOP + 0.05, 0]}>
        <boxGeometry args={[0.55, 0.1, 1.7]} />
        <meshStandardMaterial color="#1b1710" roughness={0.6} />
      </mesh>

      {/* micro-USB */}
      <mesh position={[-7.3, TOP + 0.14, 0]} castShadow>
        <boxGeometry args={[0.8, 0.28, 0.75]} />
        <meshStandardMaterial color="#b8bec6" metalness={1} roughness={0.3} />
      </mesh>
      <mesh position={[-7.66, TOP + 0.14, 0]}>
        <boxGeometry args={[0.08, 0.14, 0.5]} />
        <meshStandardMaterial color="#050607" roughness={1} />
      </mesh>

      {/* EN / BOOT tactile switches */}
      {[-0.55, 0.55].map((z) => (
        <group key={z} position={[-6.9, TOP, z]}>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.35, 0.1, 0.35]} />
            <meshStandardMaterial color="#cfd3d8" metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.07, 16]} />
            <meshStandardMaterial color="#14161a" roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* USB-serial chip, regulator, status LED */}
      <mesh position={[-6.1, TOP + 0.03, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#050607" roughness={0.7} />
      </mesh>
      <mesh position={[-5.35, TOP + 0.05, 0.75]}>
        <boxGeometry args={[0.5, 0.1, 0.4]} />
        <meshStandardMaterial color="#111317" roughness={0.6} />
      </mesh>
      <mesh position={[-5.6, TOP + 0.02, -0.75]}>
        <boxGeometry args={[0.14, 0.04, 0.1]} />
        <meshStandardMaterial color="#ff3b30" emissive="#ff3b30" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>

      {passives.map((p, i) => (
        <mesh key={i} position={[p.x, TOP + 0.03, p.z]}>
          <boxGeometry args={[0.1, 0.05, 0.06]} />
          <meshStandardMaterial color={p.cap ? '#b5895a' : '#1a1a1a'} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

export const Esp32Model = memo(function Esp32Model() {
  return (
    <PartModel url={MODEL_URLS.esp32}>
      <Procedural />
    </PartModel>
  )
})
