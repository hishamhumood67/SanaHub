/**
 * Pure data (no three.js import) describing where every part and pin sits in each 3D scene.
 * Units: 1 = 1 cm. The breadboard top surface is y = 0.
 * Because this file has no rendering code, the community schema validator can import it safely.
 */
import type { LayoutId } from '@/simulators/circuitEvaluator'
import { PINS, type PartId, type PinDef, type PinKey } from '@/simulators/pinCatalog'

export type Vec3 = [number, number, number]

/* ---- ESP32 + HC-SR04 on a breadboard ------------------------------------------------ */
export const PITCH = 0.254 // 2.54 mm hole pitch
export const HOLE_X0 = -7.62
export const ESP_PIN_X0 = HOLE_X0 + 4 * PITCH
export const ESP_ROW_Z = 1.27
export const ESP_CX = -4.78
export const SENSOR = { cx: 4.572, z: -1.27, pitch: 0.508 }

/* ---- LEGO Mindstorms (EV3) ---------------------------------------------------------- */
export const EV3 = { pos: [0, 3.6, -2] as Vec3, size: [11.2, 7.2, 7.2] as Vec3 }
export const EV3_FRONT_Z = EV3.pos[2] + EV3.size[2] / 2
export const MS_DEVICES = {
  motor: { pos: [-9.5, 1.6, 3.5] as Vec3, size: [5.6, 3.2, 3.6] as Vec3 },
  ultra: { pos: [9, 2, 4] as Vec3, size: [4.4, 3.6, 3.2] as Vec3 },
  color: { pos: [4.5, 1.5, 5] as Vec3, size: [3.2, 3, 3.2] as Vec3 },
}

function pinPosition(def: PinDef): Vec3 {
  switch (def.part) {
    case 'esp32':
      return [ESP_PIN_X0 + def.index * PITCH, 0.7, def.row === 'back' ? -ESP_ROW_Z : ESP_ROW_Z]
    case 'hcsr04':
      return [SENSOR.cx + (def.index - 1.5) * SENSOR.pitch, 0.35, SENSOR.z]
    case 'ev3':
      // simplification: both port rows face the viewer (the real brick splits them across two faces)
      return [-3.9 + def.index * 2.6, def.kind === 'ev3-out' ? 5.5 : 1.9, EV3_FRONT_Z + 0.18]
    default: {
      const d = MS_DEVICES[def.part]
      return [d.pos[0], d.pos[1] + d.size[1] / 2 + 0.25, d.pos[2]]
    }
  }
}

/** Direction a wire leaves a pin before it starts to arch or droop. */
const pinExit = (def: PinDef): Vec3 => (def.part === 'ev3' ? [0, 0, 1] : [0, 1, 0])

/** Visual pad and invisible hit-target sizes per part. */
export const PAD: Record<PartId, { hit: number; r: number; color: string }> = {
  esp32: { hit: 0.13, r: 0.085, color: '#d4af37' },
  hcsr04: { hit: 0.18, r: 0.085, color: '#d4af37' },
  ev3: { hit: 0.55, r: 0.42, color: '#7b8290' },
  motor: { hit: 0.45, r: 0.3, color: '#7b8290' },
  ultra: { hit: 0.45, r: 0.3, color: '#7b8290' },
  color: { hit: 0.45, r: 0.3, color: '#7b8290' },
}

export interface WireStyle {
  radius: number
  /** 'arch' = stiff jumper that rises between holes; 'droop' = flexible cable that hangs */
  mode: 'arch' | 'droop'
  /** arch height / droop depth as a fraction of the wire length */
  amount: number
  /** how far the wire travels straight out of the pin first */
  exit: number
  color?: string
}

export interface LayoutDef {
  id: LayoutId
  parts: PartId[]
  camera: Vec3
  target: Vec3
  wire: WireStyle
  labels: Array<{ part: PartId; at: Vec3 }>
}

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  'esp32-hcsr04': {
    id: 'esp32-hcsr04',
    parts: ['esp32', 'hcsr04'],
    camera: [0, 11, 13],
    target: [0, 0.5, 0],
    wire: { radius: 0.05, mode: 'arch', amount: 0.25, exit: 0.4 },
    labels: [
      { part: 'esp32', at: [-4.8, 1.9, 0] },
      { part: 'hcsr04', at: [SENSOR.cx, 2.9, SENSOR.z] },
    ],
  },
  mindstorms: {
    id: 'mindstorms',
    parts: ['ev3', 'motor', 'ultra', 'color'],
    camera: [0, 12, 22],
    target: [0, 2.5, 2],
    wire: { radius: 0.09, mode: 'droop', amount: 0.12, exit: 1, color: '#26282d' },
    labels: [
      { part: 'ev3', at: [0, 8, -2] },
      { part: 'motor', at: [-9.5, 4.9, 3.5] },
      { part: 'ultra', at: [9, 4.9, 4] },
      { part: 'color', at: [4.5, 3.9, 5] },
    ],
  },
}

export const isLayoutId = (v: unknown): v is LayoutId => typeof v === 'string' && v in LAYOUTS

export const layoutPins = (id: LayoutId): PinDef[] => PINS.filter((p) => LAYOUTS[id].parts.includes(p.part))

const cache = new Map<LayoutId, { pos: Record<PinKey, Vec3>; exit: Record<PinKey, Vec3> }>()

/** Pin world positions and exit directions for a layout (memoised). */
export function layoutGeometry(id: LayoutId) {
  let g = cache.get(id)
  if (!g) {
    const pins = layoutPins(id)
    g = {
      pos: Object.fromEntries(pins.map((p) => [p.key, pinPosition(p)])) as Record<PinKey, Vec3>,
      exit: Object.fromEntries(pins.map((p) => [p.key, pinExit(p)])) as Record<PinKey, Vec3>,
    }
    cache.set(id, g)
  }
  return g
}
