/**
 * The JSON format that represents a circuit. This is what gets saved, published to the
 * Community Hub, stored in the database (jsonb) and loaded back when someone remixes.
 *
 * Treat every document as UNTRUSTED input: it may come from another user or a hand-edited file.
 * parseCircuit() validates everything and rebuilds a clean object; never use the raw JSON directly.
 */
import type { LayoutId, Wire } from '@/simulators/circuitEvaluator'
import { PIN_BY_KEY, type PinKey } from '@/simulators/pinCatalog'
import { LAYOUTS, isLayoutId } from '@/3d-components/layouts'

export const SCHEMA_ID = 'sana-hub/circuit'
export const SCHEMA_VERSION = 1
export const MAX_WIRES = 64
export const MAX_JSON_CHARS = 20_000

export interface CircuitDocument {
  schema: typeof SCHEMA_ID
  version: typeof SCHEMA_VERSION
  layout: LayoutId
  wires: Array<{ a: PinKey; b: PinKey }>
  options: { echoDivider: boolean }
}

export type ParseResult = { ok: true; doc: CircuitDocument } | { ok: false; error: string }

const fail = (error: string): ParseResult => ({ ok: false, error })
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const hasPin = (k: string): k is PinKey => Object.prototype.hasOwnProperty.call(PIN_BY_KEY, k)

/** Live canvas state -> document. Ids are dropped: they are regenerated on load. */
export function serializeCircuit(layout: LayoutId, wires: Wire[], options: { echoDivider: boolean }): CircuitDocument {
  return {
    schema: SCHEMA_ID,
    version: SCHEMA_VERSION,
    layout,
    wires: wires.map((w) => ({ a: w.a, b: w.b })),
    options: { echoDivider: options.echoDivider },
  }
}

/** Untrusted value -> a validated document, or an error message. */
export function parseCircuit(input: unknown): ParseResult {
  if (!isObj(input)) return fail('Not a JSON object.')
  if (input.schema !== SCHEMA_ID) return fail('Unknown schema.')
  if (input.version !== SCHEMA_VERSION) return fail('Unsupported version.')
  if (!isLayoutId(input.layout)) return fail('Unknown layout.')
  if (!Array.isArray(input.wires) || input.wires.length > MAX_WIRES) return fail('Invalid or too many wires.')

  const layout = input.layout
  const parts = new Set(LAYOUTS[layout].parts)
  const seen = new Set<string>()
  const wires: CircuitDocument['wires'] = []

  for (const w of input.wires) {
    if (!isObj(w) || typeof w.a !== 'string' || typeof w.b !== 'string') return fail('Malformed wire.')
    const { a, b } = w
    if (!hasPin(a) || !hasPin(b) || a === b) return fail('Wire uses an unknown pin.')
    if (!parts.has(PIN_BY_KEY[a].part) || !parts.has(PIN_BY_KEY[b].part)) return fail('Wire uses a part that is not in this layout.')
    const id = [a, b].sort().join('|')
    if (seen.has(id)) continue // silently drop duplicates
    seen.add(id)
    wires.push({ a, b })
  }

  const echoDivider = isObj(input.options) && input.options.echoDivider === true
  return { ok: true, doc: { schema: SCHEMA_ID, version: SCHEMA_VERSION, layout, wires, options: { echoDivider } } }
}

/** Text (a pasted or uploaded .json file) -> validated document. */
export function parseCircuitJson(text: string): ParseResult {
  if (text.length > MAX_JSON_CHARS) return fail('File is too large.')
  try {
    return parseCircuit(JSON.parse(text))
  } catch {
    return fail('Invalid JSON.')
  }
}

/** Document -> wires with fresh ids, ready for the canvas. */
export function documentToWires(doc: CircuitDocument): Wire[] {
  const stamp = Date.now().toString(36)
  return doc.wires.map((w, i) => ({ id: `r${stamp}${i}`, a: w.a, b: w.b }))
}
