import type { LayoutId } from '@/simulators/circuitEvaluator'
import { hcsr04Template } from './hcsr04-distance'
import { mindstormsTemplate } from './mindstorms-explorer'
import type { ProjectTemplate } from './types'

/** One starter template per 3D layout. Add new projects here. */
export const TEMPLATES: Record<LayoutId, ProjectTemplate> = {
  'esp32-hcsr04': hcsr04Template,
  mindstorms: mindstormsTemplate,
}

export type { ProjectTemplate, WiringStep } from './types'
