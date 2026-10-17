import type { Localized } from '@/i18n/dictionaries'

export type PartId = 'esp32' | 'hcsr04' | 'ev3' | 'motor' | 'ultra' | 'color'
export type PinKind =
  | 'power'
  | 'gnd'
  | 'gpio'
  | 'input-only'
  | 'uart'
  | 'strap'
  | 'reset'
  | 'sensor-in'
  | 'sensor-out'
  | 'ev3-out'
  | 'ev3-in'
  | 'dev-con'
export type PinKey = `${PartId}:${string}`

export interface PinDef {
  key: PinKey
  part: PartId
  id: string
  /** silkscreen name */
  name: string
  gpio?: number
  kind: PinKind
  /** ESP32: which header row. HC-SR04: always 'back' */
  row: 'back' | 'front'
  /** position along the header, counted from the USB end (ESP32) or left to right (HC-SR04) */
  index: number
  level: string
  caps: string[]
  note: Localized
}

const L = (en: string, ar: string): Localized => ({ en, ar })

const KIND_NOTE: Record<PinKind, Localized> = {
  power: L('Power pin.', 'دبوس تغذية.'),
  gnd: L('Ground (0 V). All parts must share a common ground.', 'الأرضي (0 فولت). كل القطع لازم تشترك في أرضي واحد.'),
  gpio: L(
    'General-purpose pin. Works as digital input or output at 3.3 V.',
    'دبوس عام. يعمل كدخل أو خرج رقمي بجهد 3.3 فولت.',
  ),
  'input-only': L(
    'Input only: it cannot drive an output, so use it for sensors like ECHO or ADC readings.',
    'دخل فقط: ما يقدر يعطي خرج، فاستخدمه للحساسات مثل ECHO أو قراءات ADC.',
  ),
  uart: L(
    'Wired to the USB-serial chip. Using it can break uploads and the Serial Monitor.',
    'موصول بشريحة USB-سيريال. استخدامه قد يخرّب الرفع ومراقب السيريال.',
  ),
  strap: L(
    'Boot strapping pin: its level at power-up changes how the ESP32 boots.',
    'دبوس إقلاع: مستواه لحظة التشغيل يغيّر طريقة إقلاع ESP32.',
  ),
  reset: L('Pull low to reset the chip.', 'اسحبه إلى الأرضي لإعادة تشغيل الشريحة.'),
  'sensor-in': L('Input of the sensor.', 'مدخل الحساس.'),
  'sensor-out': L('Output of the sensor.', 'مخرج الحساس.'),
  'ev3-out': L('EV3 output port: powers and drives motors.', 'منفذ خرج EV3: يغذّي المحركات ويتحكم بها.'),
  'ev3-in': L('EV3 input port: reads sensors.', 'منفذ دخل EV3: يقرأ الحساسات.'),
  'dev-con': L('Cable socket of a motor or sensor.', 'مقبس كابل المحرك أو الحساس.'),
}

type Row = 'back' | 'front'
interface EspSpec {
  id: string
  name: string
  kind: PinKind
  gpio?: number
  caps?: string[]
  level?: string
  note?: Localized
}

// DOIT ESP32 DevKit V1 (30 pins), listed from the USB end.
const ESP_BACK: EspSpec[] = [
  { id: 'VIN', name: 'VIN', kind: 'power', level: '≈5 V (from USB)', note: L('≈5 V straight from USB. Power 5 V modules such as the HC-SR04 from here.', '≈5 فولت مباشرة من USB. غذّي منه الوحدات التي تحتاج 5 فولت مثل HC-SR04.') },
  { id: 'GND1', name: 'GND', kind: 'gnd', level: '0 V' },
  { id: 'D13', name: 'D13', kind: 'gpio', gpio: 13, caps: ['ADC2', 'Touch', 'PWM'] },
  { id: 'D12', name: 'D12', kind: 'strap', gpio: 12, caps: ['ADC2', 'Touch', 'PWM'], note: L('Strapping pin (flash voltage). If it is HIGH at boot the board may not start.', 'دبوس إقلاع (جهد الفلاش). إذا كان HIGH وقت التشغيل قد لا تقلع اللوحة.') },
  { id: 'D14', name: 'D14', kind: 'gpio', gpio: 14, caps: ['ADC2', 'Touch', 'PWM'] },
  { id: 'D27', name: 'D27', kind: 'gpio', gpio: 27, caps: ['ADC2', 'Touch', 'PWM'] },
  { id: 'D26', name: 'D26', kind: 'gpio', gpio: 26, caps: ['ADC2', 'DAC2', 'PWM'] },
  { id: 'D25', name: 'D25', kind: 'gpio', gpio: 25, caps: ['ADC2', 'DAC1', 'PWM'] },
  { id: 'D33', name: 'D33', kind: 'gpio', gpio: 33, caps: ['ADC1', 'Touch', 'PWM'] },
  { id: 'D32', name: 'D32', kind: 'gpio', gpio: 32, caps: ['ADC1', 'Touch', 'PWM'] },
  { id: 'D35', name: 'D35', kind: 'input-only', gpio: 35, caps: ['ADC1'] },
  { id: 'D34', name: 'D34', kind: 'input-only', gpio: 34, caps: ['ADC1'] },
  { id: 'VN', name: 'VN', kind: 'input-only', gpio: 39, caps: ['ADC1'] },
  { id: 'VP', name: 'VP', kind: 'input-only', gpio: 36, caps: ['ADC1'] },
  { id: 'EN', name: 'EN', kind: 'reset', level: '3.3 V (active low)' },
]

const ESP_FRONT: EspSpec[] = [
  { id: '3V3', name: '3V3', kind: 'power', level: '3.3 V', note: L('3.3 V regulated output. Max ≈500 mA total.', 'خرج 3.3 فولت منظّم. الحد الأقصى ≈500 مللي أمبير إجمالًا.') },
  { id: 'GND2', name: 'GND', kind: 'gnd', level: '0 V' },
  { id: 'D15', name: 'D15', kind: 'strap', gpio: 15, caps: ['ADC2', 'Touch', 'PWM'], note: L('Strapping pin (boot log silencing).', 'دبوس إقلاع (التحكم بطباعة سجل الإقلاع).') },
  { id: 'D2', name: 'D2', kind: 'strap', gpio: 2, caps: ['ADC2', 'Touch', 'PWM'], note: L('Strapping pin, also drives the onboard LED.', 'دبوس إقلاع، ويشغّل أيضًا ليد اللوحة.') },
  { id: 'D4', name: 'D4', kind: 'gpio', gpio: 4, caps: ['ADC2', 'Touch', 'PWM'] },
  { id: 'RX2', name: 'RX2', kind: 'gpio', gpio: 16, caps: ['UART2 RX', 'PWM'] },
  { id: 'TX2', name: 'TX2', kind: 'gpio', gpio: 17, caps: ['UART2 TX', 'PWM'] },
  { id: 'D5', name: 'D5', kind: 'strap', gpio: 5, caps: ['VSPI SS', 'PWM'], note: L('Strapping pin (SDIO timing). Fine for most uses, but avoid forcing it at boot.', 'دبوس إقلاع (توقيت SDIO). مناسب لمعظم الاستخدامات لكن لا تفرض عليه مستوى وقت الإقلاع.') },
  { id: 'D18', name: 'D18', kind: 'gpio', gpio: 18, caps: ['VSPI SCK', 'PWM'] },
  { id: 'D19', name: 'D19', kind: 'gpio', gpio: 19, caps: ['VSPI MISO', 'PWM'] },
  { id: 'D21', name: 'D21', kind: 'gpio', gpio: 21, caps: ['I²C SDA', 'PWM'] },
  { id: 'RX0', name: 'RX0', kind: 'uart', gpio: 3, caps: ['UART0 RX'] },
  { id: 'TX0', name: 'TX0', kind: 'uart', gpio: 1, caps: ['UART0 TX'] },
  { id: 'D22', name: 'D22', kind: 'gpio', gpio: 22, caps: ['I²C SCL', 'PWM'] },
  { id: 'D23', name: 'D23', kind: 'gpio', gpio: 23, caps: ['VSPI MOSI', 'PWM'] },
]

function espPins(specs: EspSpec[], row: Row): PinDef[] {
  return specs.map((s, index) => ({
    key: `esp32:${s.id}` as PinKey,
    part: 'esp32',
    id: s.id,
    name: s.name,
    gpio: s.gpio,
    kind: s.kind,
    row,
    index,
    level: s.level ?? (s.kind === 'input-only' || s.kind === 'gpio' || s.kind === 'strap' || s.kind === 'uart' ? '3.3 V logic (not 5 V tolerant)' : '—'),
    caps: s.caps ?? [],
    note: s.note ?? KIND_NOTE[s.kind],
  }))
}

const SENSOR: Array<Omit<PinDef, 'key' | 'part' | 'row' | 'index'>> = [
  { id: 'VCC', name: 'VCC', kind: 'power', level: '5 V', caps: [], note: L('Needs 5 V. Powering it from 3.3 V gives unreliable readings.', 'يحتاج 5 فولت. تغذيته بـ 3.3 فولت تعطي قراءات غير مستقرة.') },
  { id: 'TRIG', name: 'TRIG', kind: 'sensor-in', level: '3.3 V is enough (needs ≥ 2 V)', caps: ['10 µs trigger pulse'], note: L('Send a 10 µs HIGH pulse here to start a measurement.', 'أرسل نبضة HIGH مدتها 10 ميكروثانية هنا لبدء القياس.') },
  { id: 'ECHO', name: 'ECHO', kind: 'sensor-out', level: '5 V output pulse', caps: ['Pulse width = round-trip time'], note: L('Outputs a 5 V pulse whose width is the echo travel time. Reduce it to 3.3 V before an ESP32 pin.', 'يخرج نبضة 5 فولت عرضها زمن ذهاب وعودة الصدى. اخفضها إلى 3.3 فولت قبل دبوس ESP32.') },
  { id: 'GND', name: 'GND', kind: 'gnd', level: '0 V', caps: [], note: KIND_NOTE.gnd },
]

const dev = (part: PartId, id: string, name: string, kind: PinKind, note: Localized, index: number): PinDef => ({
  key: `${part}:${id}` as PinKey,
  part,
  id,
  name,
  kind,
  row: 'back',
  index,
  level: '6-wire EV3 cable',
  caps: [],
  note,
})

const EV3_PINS: PinDef[] = [
  ...['A', 'B', 'C', 'D'].map((n, i) => dev('ev3', n, n, 'ev3-out', L(`Output port ${n}: for motors.`, `منفذ الخرج ${n}: للمحركات.`), i)),
  ...['1', '2', '3', '4'].map((n, i) => dev('ev3', n, n, 'ev3-in', L(`Input port ${n}: for sensors.`, `منفذ الدخل ${n}: للحساسات.`), i)),
  dev('motor', 'CON', 'Motor', 'dev-con', L('Motor cable socket. Plug it into an output port (A–D).', 'مقبس كابل المحرك. وصّله بمنفذ خرج (A–D).'), 0),
  dev('ultra', 'CON', 'Ultrasonic sensor', 'dev-con', L('Sensor cable socket. Plug it into an input port (1–4).', 'مقبس كابل الحساس. وصّله بمنفذ دخل (1–4).'), 0),
  dev('color', 'CON', 'Color sensor', 'dev-con', L('Sensor cable socket. Plug it into an input port (1–4).', 'مقبس كابل الحساس. وصّله بمنفذ دخل (1–4).'), 0),
]

export const PINS: PinDef[] = [
  ...espPins(ESP_BACK, 'back'),
  ...espPins(ESP_FRONT, 'front'),
  ...SENSOR.map<PinDef>((s, index) => ({
    ...s,
    key: `hcsr04:${s.id}` as PinKey,
    part: 'hcsr04',
    row: 'back',
    index,
  })),
  ...EV3_PINS,
]

export const PIN_BY_KEY = Object.fromEntries(PINS.map((p) => [p.key, p])) as Record<PinKey, PinDef>

/** Human label used in messages: "GPIO34", "GPIO36 (VP)", "VIN", "HC-SR04 ECHO" */
export function pinLabel(key: PinKey): string {
  const p = PIN_BY_KEY[key]
  if (!p) return key
  if (p.part === 'ev3') return `EV3 port ${p.name}`
  if (p.part === 'motor' || p.part === 'ultra' || p.part === 'color') return `${p.name} cable`
  if (p.part === 'hcsr04') return `HC-SR04 ${p.name}`
  if (p.gpio !== undefined) {
    const plain = `D${p.gpio}`
    return p.name === plain ? `GPIO${p.gpio}` : `GPIO${p.gpio} (${p.name})`
  }
  return p.name
}
