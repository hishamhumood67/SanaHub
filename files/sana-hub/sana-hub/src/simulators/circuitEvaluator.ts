import type { Localized } from '@/i18n/dictionaries'
import { PIN_BY_KEY, pinLabel, type PinDef, type PinKey } from './pinCatalog'

export interface Wire {
  id: string
  a: PinKey
  b: PinKey
}

export type Severity = 'error' | 'warning' | 'info'
export type LayoutId = 'esp32-hcsr04' | 'mindstorms'
export type StepId = 'gnd' | 'vcc' | 'trig' | 'echo'
export type StepState = 'todo' | 'ok' | 'bad'
export const STEP_ORDER: StepId[] = ['gnd', 'vcc', 'trig', 'echo']

export interface Issue {
  id: string
  severity: Severity
  step?: string
  pins: PinKey[]
  msg: Localized
  fix: Localized
}

export interface EvalResult {
  issues: Issue[]
  steps: Record<string, StepState>
  stepOrder: string[]
  /** pins to ring on the 3D board */
  flagged: Partial<Record<PinKey, Severity>>
  done: number
  total: number
  complete: boolean
}

export interface EvalOptions {
  /** user confirms a 1k/2k divider (or level shifter) sits on ECHO */
  echoDivider: boolean
}

const L = (en: string, ar: string): Localized => ({ en, ar })
const labels = (pins: PinKey[]) => pins.map(pinLabel).join(', ')
const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

const S = (id: string) => `hcsr04:${id}` as PinKey
const isGnd = (p: PinDef) => p.kind === 'gnd'
const isRail = (p: PinDef) => p.kind === 'power'
const isEspIo = (p: PinDef) =>
  p.part === 'esp32' && (p.kind === 'gpio' || p.kind === 'input-only' || p.kind === 'uart' || p.kind === 'strap')

/** Union-find over pins joined by wires -> electrical nets */
function buildNets(wires: Wire[]) {
  const parent = new Map<PinKey, PinKey>()
  const touched = new Set<PinKey>()
  const find = (k: PinKey): PinKey => {
    const p = parent.get(k)
    if (p === undefined || p === k) return k
    const root = find(p)
    parent.set(k, root)
    return root
  }
  for (const w of wires) {
    if (w.a === w.b) continue
    touched.add(w.a)
    touched.add(w.b)
    const ra = find(w.a)
    const rb = find(w.b)
    if (ra !== rb) parent.set(ra, rb)
  }
  const groups = new Map<PinKey, PinKey[]>()
  touched.forEach((k) => {
    const r = find(k)
    groups.set(r, [...(groups.get(r) ?? []), k])
  })
  const peers = (k: PinKey): PinKey[] => {
    if (!touched.has(k)) return []
    return (groups.get(find(k)) ?? []).filter((p) => p !== k)
  }
  return { groups: [...groups.values()], peers, touched }
}

export function evaluateEsp32Circuit(wires: Wire[], opts: EvalOptions): EvalResult {
  const { groups, peers, touched } = buildNets(wires)
  const issues: Issue[] = []
  const steps: Record<StepId, StepState> = { gnd: 'todo', vcc: 'todo', trig: 'todo', echo: 'todo' }
  const add = (i: Issue) => issues.push(i)
  const defs = (keys: PinKey[]) => keys.map((k) => PIN_BY_KEY[k]).filter(Boolean)

  // ---- Generic net rules (shorts and contention) ---------------------------------------
  groups.forEach((net, n) => {
    const d = defs(net)
    const gnd = d.filter(isGnd)
    const rails = d.filter(isRail)
    const io = d.filter(isEspIo)
    const hasSensor = d.some((p) => p.part === 'hcsr04')

    if (gnd.length && rails.length) {
      add({
        id: `short-gnd-${n}`,
        severity: 'error',
        pins: [...gnd, ...rails].map((p) => p.key),
        msg: L(
          `Short circuit: ${labels(rails.map((p) => p.key))} is connected to GND.`,
          `ماس كهربائي: ${labels(rails.map((p) => p.key))} موصول مع GND.`,
        ),
        fix: L(
          'Unplug the wire that joins them right away. A short can overheat the USB port or the regulator.',
          'افصل السلك الذي يربطهما فورًا. الماس قد يسخّن منفذ USB أو المنظّم.',
        ),
      })
    } else if (new Set(rails.map((p) => p.key)).has('esp32:VIN') && new Set(rails.map((p) => p.key)).has('esp32:3V3')) {
      add({
        id: `rail-clash-${n}`,
        severity: 'error',
        pins: ['esp32:VIN', 'esp32:3V3'],
        msg: L('VIN (5 V) and 3V3 are tied together.', 'VIN (5 فولت) و3V3 موصولان ببعض.'),
        fix: L('Two supplies must never be joined. Keep each rail on its own wire.', 'ممنوع ربط مصدرين ببعض. اجعل كل خط تغذية بسلكه الخاص.'),
      })
    }

    if (io.length >= 2) {
      add({
        id: `io-tied-${n}`,
        severity: 'warning',
        pins: io.map((p) => p.key),
        msg: L(`${labels(io.map((p) => p.key))} are wired together.`, `${labels(io.map((p) => p.key))} موصولة ببعض.`),
        fix: L(
          'If both are outputs they fight each other. Give every signal its own pin.',
          'إذا كان الاثنان خرجين فسيتعارضان. أعطِ كل إشارة دبوسها الخاص.',
        ),
      })
    }

    const fiveVolt = rails.filter((p) => p.key === 'esp32:VIN')
    if (io.length && fiveVolt.length && !gnd.length) {
      add({
        id: `volt-mismatch-${n}`,
        severity: 'error',
        pins: [...io, ...fiveVolt].map((p) => p.key),
        msg: L(
          `Voltage mismatch: the 5 V pin VIN is wired to ${labels(io.map((p) => p.key))}, which only tolerates 3.3 V.`,
          `عدم تطابق جهد: دبوس 5 فولت (VIN) موصول مع ${labels(io.map((p) => p.key))} الذي يتحمل 3.3 فولت فقط.`,
        ),
        fix: L(
          'Disconnect it now. ESP32 GPIO pins are not 5 V tolerant. Use VIN only to power modules that need 5 V.',
          'افصله الآن. دبابيس GPIO في ESP32 لا تتحمل 5 فولت. استخدم VIN فقط لتغذية الوحدات التي تحتاج 5 فولت.',
        ),
      })
    } else if (io.length && (gnd.length || rails.length) && !hasSensor) {
      add({
        id: `io-rail-${n}`,
        severity: 'warning',
        pins: net,
        msg: L(
          `${labels(io.map((p) => p.key))} is wired straight to a power rail or GND.`,
          `${labels(io.map((p) => p.key))} موصول مباشرة بخط تغذية أو GND.`,
        ),
        fix: L('Remove the wire unless you are doing it on purpose (for example a pull-up).', 'أزل السلك إلا إذا كنت تقصد ذلك (مثل مقاومة رفع).'),
      })
    }
  })

  // ---- GND ----------------------------------------------------------------------------
  {
    const k = S('GND')
    const p = defs(peers(k))
    if (touched.has(k)) {
      if (p.some((x) => x.part === 'esp32' && isGnd(x))) {
        steps.gnd = p.some(isRail) ? 'bad' : 'ok'
      } else {
        steps.gnd = 'bad'
        add({
          id: 'gnd-wrong',
          severity: 'error',
          step: 'gnd',
          pins: [k, ...peers(k)],
          msg: L(
            `Sensor GND is wired to ${labels(peers(k))}, not to an ESP32 GND pin.`,
            `GND الحساس موصول مع ${labels(peers(k))} وليس مع GND في ESP32.`,
          ),
          fix: L(
            'Move the wire to any GND pin of the ESP32 so both boards share the same 0 V reference.',
            'انقل السلك إلى أي دبوس GND في ESP32 حتى يشترك الاثنان في نفس مرجع 0 فولت.',
          ),
        })
      }
    }
  }

  // ---- VCC ----------------------------------------------------------------------------
  {
    const k = S('VCC')
    const p = defs(peers(k))
    if (touched.has(k)) {
      if (p.some(isGnd)) {
        steps.vcc = 'bad' // reported as a short above
      } else if (p.some((x) => x.key === 'esp32:VIN')) {
        steps.vcc = 'ok'
      } else if (p.some((x) => x.key === 'esp32:3V3')) {
        steps.vcc = 'bad'
        add({
          id: 'vcc-3v3',
          severity: 'warning',
          step: 'vcc',
          pins: [k, 'esp32:3V3'],
          msg: L(
            'The HC-SR04 is a 5 V module. On 3.3 V it often reads 0 cm or random values.',
            'حساس HC-SR04 يعمل بـ 5 فولت. على 3.3 فولت غالبًا يعطي 0 سم أو قراءات عشوائية.',
          ),
          fix: L('Move VCC to the VIN pin (≈5 V from USB).', 'انقل VCC إلى دبوس VIN (≈5 فولت من USB).'),
        })
      } else if (p.some(isEspIo)) {
        steps.vcc = 'bad'
        add({
          id: 'vcc-gpio',
          severity: 'error',
          step: 'vcc',
          pins: [k, ...peers(k)],
          msg: L(
            `VCC is wired to ${labels(peers(k))}. A GPIO pin cannot supply enough current to power the sensor.`,
            `VCC موصول مع ${labels(peers(k))}. دبوس GPIO ما يقدر يعطي تيار كافي لتشغيل الحساس.`,
          ),
          fix: L('Power the sensor from VIN, not from a signal pin.', 'غذّ الحساس من VIN وليس من دبوس إشارة.'),
        })
      } else {
        steps.vcc = 'bad'
        add({
          id: 'vcc-wrong',
          severity: 'error',
          step: 'vcc',
          pins: [k, ...peers(k)],
          msg: L(`VCC is wired to ${labels(peers(k))}.`, `VCC موصول مع ${labels(peers(k))}.`),
          fix: L('VCC belongs on the ESP32 VIN pin.', 'مكان VCC هو دبوس VIN في ESP32.'),
        })
      }
    }
  }

  // ---- TRIG / ECHO ----------------------------------------------------------------------
  const tied = peers(S('TRIG')).includes(S('ECHO'))
  if (tied) {
    steps.trig = 'bad'
    steps.echo = 'bad'
    add({
      id: 'trig-echo-tied',
      severity: 'error',
      pins: [S('TRIG'), S('ECHO')],
      msg: L('TRIG and ECHO are wired together.', 'TRIG وECHO موصولان ببعض.'),
      fix: L(
        'The HC-SR04 needs two separate ESP32 pins: one output for TRIG and one input for ECHO.',
        'يحتاج HC-SR04 إلى دبوسين منفصلين في ESP32: خرج لـ TRIG ودخل لـ ECHO.',
      ),
    })
  }

  const checkSignal = (which: 'TRIG' | 'ECHO') => {
    const step: StepId = which === 'TRIG' ? 'trig' : 'echo'
    const k = S(which)
    if (!touched.has(k) || tied) return
    const p = defs(peers(k))
    const io = p.find(isEspIo)
    const low = which.toLowerCase()

    if (p.some((x) => isGnd(x) || isRail(x))) {
      steps[step] = 'bad'
      add({
        id: `${low}-rail`,
        severity: 'error',
        step,
        pins: [k, ...peers(k)],
        msg: L(`${which} is wired to a power rail or GND.`, `${which} موصول بخط تغذية أو GND.`),
        fix: L(`${which} is a signal. Connect it to a GPIO pin.`, `${which} إشارة. وصّله بدبوس GPIO.`),
      })
      return
    }
    if (!io) {
      steps[step] = 'bad'
      add({
        id: `${low}-wrong`,
        severity: 'error',
        step,
        pins: [k, ...peers(k)],
        msg: L(`${which} is not connected to an ESP32 GPIO pin.`, `${which} غير موصول بدبوس GPIO في ESP32.`),
        fix: L('Run the wire to a GPIO pin such as GPIO18 or GPIO19.', 'مدّ السلك إلى دبوس GPIO مثل GPIO18 أو GPIO19.'),
      })
      return
    }

    const name = pinLabel(io.key)
    steps[step] = 'ok'

    if (which === 'TRIG' && io.kind === 'input-only') {
      steps[step] = 'bad'
      add({
        id: 'trig-input-only',
        severity: 'error',
        step,
        pins: [k, io.key],
        msg: L(
          `${name} is input-only, so it cannot send the 10 µs trigger pulse.`,
          `${name} دخل فقط، فما يقدر يرسل نبضة التشغيل 10 ميكروثانية.`,
        ),
        fix: L(
          'Use an output-capable pin such as GPIO18, GPIO23 or GPIO13.',
          'استخدم دبوسًا يدعم الخرج مثل GPIO18 أو GPIO23 أو GPIO13.',
        ),
      })
    } else if (io.kind === 'uart') {
      add({
        id: `${low}-uart`,
        severity: 'warning',
        step,
        pins: [k, io.key],
        msg: L(
          `${name} is shared with the USB serial chip. It can disturb uploads and your Serial Monitor.`,
          `${name} مشترك مع شريحة USB-سيريال، وقد يخرّب الرفع ومراقب السيريال.`,
        ),
        fix: L('Prefer GPIO18, GPIO19, GPIO23 or GPIO13.', 'الأفضل GPIO18 أو GPIO19 أو GPIO23 أو GPIO13.'),
      })
    } else if (io.kind === 'strap') {
      add({
        id: `${low}-strap`,
        severity: 'warning',
        step,
        pins: [k, io.key],
        msg: L(
          `${name} is a boot-strapping pin. A sensor holding it at the wrong level can stop the ESP32 from starting.`,
          `${name} دبوس إقلاع. لو الحساس ثبّته على مستوى خاطئ قد لا تقلع ESP32.`,
        ),
        fix: L('Prefer GPIO18, GPIO19 or GPIO23, or unplug the sensor while uploading.', 'الأفضل GPIO18 أو GPIO19 أو GPIO23، أو افصل الحساس أثناء الرفع.'),
      })
    }

    if (which === 'ECHO' && steps.echo === 'ok') {
      if (opts.echoDivider) {
        add({
          id: 'echo-divider-ok',
          severity: 'info',
          step,
          pins: [k, io.key],
          msg: L(
            'Good call: the divider brings ECHO down to about 3.3 V (5 V × 2 ÷ 3).',
            'قرار ممتاز: المقسّم ينزّل ECHO إلى نحو 3.3 فولت (5 × 2 ÷ 3).',
          ),
          fix: L('Keep 1 kΩ in series from ECHO and 2 kΩ from the pin to GND.', 'أبقِ 1 كيلو أوم على التسلسل من ECHO و2 كيلو أوم من الدبوس إلى GND.'),
        })
      } else {
        steps.echo = 'bad'
        add({
          id: 'echo-5v',
          severity: 'warning',
          step,
          pins: [k, io.key],
          msg: L(
            `ECHO outputs a 5 V pulse, but ${name} only tolerates 3.3 V. Over time this can damage the ESP32.`,
            `ECHO يخرج نبضة 5 فولت، بينما ${name} يتحمل 3.3 فولت فقط. مع الوقت قد يتلف ESP32.`,
          ),
          fix: L(
            'Add a divider (1 kΩ from ECHO to the pin, 2 kΩ from the pin to GND) or a level shifter, then tick the box above.',
            'أضف مقسّم جهد (1 كيلو أوم من ECHO إلى الدبوس و2 كيلو أوم من الدبوس إلى GND) أو محوّل مستوى، ثم علّم المربع بالأعلى.',
          ),
        })
      }
    }
  }
  checkSignal('TRIG')
  checkSignal('ECHO')

  // ---- Summary -------------------------------------------------------------------------
  issues.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity])

  const flagged: EvalResult['flagged'] = {}
  for (const i of issues) {
    if (i.severity === 'info') continue
    for (const pin of i.pins) {
      if (flagged[pin] !== 'error') flagged[pin] = i.severity
    }
  }

  const done = STEP_ORDER.filter((s) => steps[s] === 'ok').length
  const complete = done === STEP_ORDER.length && !issues.some((i) => i.severity === 'error')

  return { issues, steps, stepOrder: STEP_ORDER, flagged, done, total: STEP_ORDER.length, complete }
}

/* ---------------------------------------------------------------------------------------
 * LEGO Mindstorms (EV3): motors belong on output ports A-D, sensors on input ports 1-4.
 * ------------------------------------------------------------------------------------- */
const MS_ORDER = ['motor', 'ultra', 'color']
const MS_DEVICES: Array<{ step: string; key: PinKey; wants: 'ev3-out' | 'ev3-in'; name: Localized; ports: Localized }> = [
  { step: 'motor', key: 'motor:CON', wants: 'ev3-out', name: L('The motor', 'المحرك'), ports: L('output ports A-D', 'منافذ الخرج A-D') },
  { step: 'ultra', key: 'ultra:CON', wants: 'ev3-in', name: L('The ultrasonic sensor', 'الحساس فوق الصوتي'), ports: L('input ports 1-4', 'منافذ الدخل 1-4') },
  { step: 'color', key: 'color:CON', wants: 'ev3-in', name: L('The color sensor', 'حساس اللون'), ports: L('input ports 1-4', 'منافذ الدخل 1-4') },
]

function summarize(issues: Issue[], steps: Record<string, StepState>, order: string[]): EvalResult {
  issues.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity])
  const flagged: EvalResult['flagged'] = {}
  for (const i of issues) {
    if (i.severity === 'info') continue
    for (const pin of i.pins) if (flagged[pin] !== 'error') flagged[pin] = i.severity
  }
  const done = order.filter((s) => steps[s] === 'ok').length
  return {
    issues,
    steps,
    stepOrder: order,
    flagged,
    done,
    total: order.length,
    complete: done === order.length && !issues.some((i) => i.severity === 'error'),
  }
}

export function evaluateMindstorms(wires: Wire[]): EvalResult {
  const { groups, peers, touched } = buildNets(wires)
  const issues: Issue[] = []
  const steps: Record<string, StepState> = { motor: 'todo', ultra: 'todo', color: 'todo' }

  for (const dev of MS_DEVICES) {
    if (!touched.has(dev.key)) continue
    const port = peers(dev.key).map((k) => PIN_BY_KEY[k]).find((p) => p?.part === 'ev3')
    if (!port) {
      steps[dev.step] = 'bad'
      issues.push({
        id: `${dev.step}-noport`,
        severity: 'error',
        step: dev.step,
        pins: [dev.key, ...peers(dev.key)],
        msg: L(`${dev.name.en} is not plugged into an EV3 port.`, `${dev.name.ar} غير موصول بمنفذ في EV3.`),
        fix: L(`Plug the cable into one of the ${dev.ports.en}.`, `وصّل الكابل بأحد ${dev.ports.ar}.`),
      })
    } else if (port.kind !== dev.wants) {
      steps[dev.step] = 'bad'
      issues.push({
        id: `${dev.step}-wrongport`,
        severity: 'error',
        step: dev.step,
        pins: [dev.key, port.key],
        msg: L(
          `${dev.name.en} is plugged into ${pinLabel(port.key)}, but it needs ${dev.ports.en}.`,
          `${dev.name.ar} موصول بـ ${pinLabel(port.key)} لكنه يحتاج ${dev.ports.ar}.`,
        ),
        fix: L(`Move the cable to one of the ${dev.ports.en}.`, `انقل الكابل إلى أحد ${dev.ports.ar}.`),
      })
    } else {
      steps[dev.step] = 'ok'
    }
  }

  groups.forEach((net, n) => {
    const devs = MS_DEVICES.filter((d) => net.includes(d.key))
    if (devs.length > 1) {
      devs.forEach((d) => (steps[d.step] = 'bad'))
      issues.push({
        id: `ms-shared-${n}`,
        severity: 'error',
        pins: net,
        msg: L('Two devices share one EV3 port.', 'جهازان يشتركان في منفذ EV3 واحد.'),
        fix: L('Give every motor and sensor its own port.', 'أعطِ كل محرك وحساس منفذه الخاص.'),
      })
    }
    const ports = net.filter((k) => PIN_BY_KEY[k]?.part === 'ev3')
    if (ports.length > 1) {
      issues.push({
        id: `ms-ports-${n}`,
        severity: 'error',
        pins: ports,
        msg: L('Two EV3 ports are wired to each other.', 'منفذان في EV3 موصولان ببعض.'),
        fix: L('Cables go from a port to a motor or sensor, never port to port.', 'الكابلات تمتد من المنفذ إلى محرك أو حساس، وليس من منفذ إلى منفذ.'),
      })
    }
  })

  return summarize(issues, steps, MS_ORDER)
}

/** Single entry point used by the UI. */
export function evaluateCircuit(layout: LayoutId, wires: Wire[], opts: EvalOptions): EvalResult {
  return layout === 'mindstorms' ? evaluateMindstorms(wires) : evaluateEsp32Circuit(wires, opts)
}
