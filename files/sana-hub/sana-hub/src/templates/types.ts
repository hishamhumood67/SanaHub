import type { Localized } from '@/i18n/dictionaries'
import type { LayoutId } from '@/simulators/circuitEvaluator'
import type { PinKey } from '@/simulators/pinCatalog'

export interface WiringStep {
  /** must match a step id produced by the evaluator for this layout */
  id: string
  title: Localized
  body: Localized
  /** pins that pulse on the 3D board when the learner clicks the step */
  pins: PinKey[]
}

export interface ProjectTemplate {
  id: string
  layout: LayoutId
  title: Localized
  summary: Localized
  steps: WiringStep[]
  codeLang: 'cpp' | 'python'
  starterCode: string
  codeExplain: Array<{ code: string; note: Localized }>
}
