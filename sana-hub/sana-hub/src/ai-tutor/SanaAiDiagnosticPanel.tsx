'use client'

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AlertTriangle, Bot, Check, CircleDashed, Info, LocateFixed, OctagonAlert, SendHorizontal } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'
import { dictionaries, type DictKey, type Lang, type Localized } from '@/i18n/dictionaries'
import type { EvalResult, Issue, Severity, StepState } from '@/simulators/circuitEvaluator'
import type { PinKey } from '@/simulators/pinCatalog'
import type { ProjectTemplate } from '@/templates/types'
import { tutorAnswer, type TutorContext } from './tutorBrain'

export interface SanaAiDiagnosticPanelProps {
  /** the active project template: steps, starter code, layout */
  template: ProjectTemplate
  /** output of evaluateCircuit(), computed by the page so the 3D board and tutor share one source of truth */
  result: EvalResult
  echoDivider: boolean
  onEchoDividerChange: (value: boolean) => void
  /** pins to pulse on the 3D board; pass [] to clear */
  onHighlight?: (pins: PinKey[]) => void
  /** optional: plug in a real model (e.g. a /api/maker-ai route). Return text in `lang`. */
  askRemote?: (question: string, ctx: TutorContext, lang: Lang) => Promise<string>
  className?: string
}

type ChatMessage =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'ai'; text: Localized<string> | string }

const SEVERITY_STYLE: Record<Severity, { ring: string; chip: string; icon: typeof Info }> = {
  error: { ring: 'border-alert/60', chip: 'bg-alert/15 text-alert', icon: OctagonAlert },
  warning: { ring: 'border-copper/60', chip: 'bg-copper/15 text-copper', icon: AlertTriangle },
  info: { ring: 'border-saudiBright/50', chip: 'bg-saudiBright/15 text-saudiBright', icon: Info },
}

const STEP_STYLE: Record<StepState, string> = {
  todo: 'text-mist/50',
  ok: 'text-saudiBright',
  bad: 'text-copper',
}

const QUICK: Array<{ key: DictKey; ask: Localized }> = [
  { key: 'tutor.quick.why', ask: { en: "Why isn't it working?", ar: 'ليش ما يشتغل؟' } },
  { key: 'tutor.quick.echo', ask: { en: 'Why do I need a divider?', ar: 'ليش أحتاج مقسّم جهد؟' } },
  { key: 'tutor.quick.code', ask: { en: 'Explain the code', ar: 'اشرح لي الكود' } },
  { key: 'tutor.quick.blocks', ask: { en: 'Convert blocks to C++', ar: 'حوّل البلوكات إلى C++' } },
]

/* --------------------------------------------------------------------------- small pieces */

/** Renders paragraphs and ``` code fences. Code is always left-to-right, even in Arabic. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split('```').map((part, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            dir="ltr"
            className="my-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-start font-mono text-xs leading-relaxed text-mist"
          >
            {part.replace(/^\w*\n/, '').trimEnd()}
          </pre>
        ) : part.trim() ? (
          <p key={i} className="whitespace-pre-line">
            {part.trim()}
          </p>
        ) : null,
      )}
    </>
  )
}

function ScoreRing({ done, total }: { done: number; total: number }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="5" />
      <circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="#19B368"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / total)}
        className="transition-[stroke-dashoffset] duration-500 motion-reduce:transition-none"
      />
    </svg>
  )
}

function StepIcon({ state }: { state: StepState }) {
  const cls = `size-4 ${STEP_STYLE[state]}`
  if (state === 'ok') return <Check className={cls} aria-hidden="true" />
  if (state === 'bad') return <AlertTriangle className={cls} aria-hidden="true" />
  return <CircleDashed className={cls} aria-hidden="true" />
}

/* --------------------------------------------------------------------------- panel */

export default function SanaAiDiagnosticPanel({
  template,
  result,
  echoDivider,
  onEchoDividerChange,
  onHighlight,
  askRemote,
  className = '',
}: SanaAiDiagnosticPanelProps) {
  const { t, pick, lang } = useLanguage()
  const [tab, setTab] = useState<'review' | 'chat'>('review')
  const [lit, setLit] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    { id: 0, role: 'ai', text: { en: dictionaries.en['tutor.greeting'], ar: dictionaries.ar['tutor.greeting'] } },
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const nextId = useRef(1)
  const endRef = useRef<HTMLDivElement>(null)
  const ctxRef = useRef<TutorContext>({ result, echoDivider, template })
  ctxRef.current = { result, echoDivider, template }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, pending, tab])

  // clear board highlights when the panel goes away
  useEffect(() => () => onHighlight?.([]), [onHighlight])

  const highlight = (id: string, pins: PinKey[]) => {
    const off = lit === id
    setLit(off ? null : id)
    onHighlight?.(off ? [] : pins)
  }

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim()
      if (!question || pending) return
      setMessages((m) => [...m, { id: nextId.current++, role: 'user', text: question }])
      setInput('')
      setPending(true)
      let reply: Localized<string> | string
      try {
        if (askRemote) {
          reply = await askRemote(question, ctxRef.current, lang)
        } else {
          await new Promise((r) => setTimeout(r, 450 + Math.random() * 450))
          reply = tutorAnswer(question, ctxRef.current)
        }
      } catch {
        reply = { en: dictionaries.en['tutor.error'], ar: dictionaries.ar['tutor.error'] }
      }
      setMessages((m) => [...m, { id: nextId.current++, role: 'ai', text: reply }])
      setPending(false)
    },
    [askRemote, lang, pending],
  )

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void send(input)
  }

  const render = (text: Localized<string> | string) => (typeof text === 'string' ? text : pick(text))
  const realIssues: Issue[] = result.issues

  const tabBtn = (id: 'review' | 'chat', label: string) => (
    <button
      type="button"
      role="tab"
      id={`tutor-tab-${id}`}
      aria-selected={tab === id}
      aria-controls={`tutor-panel-${id}`}
      onClick={() => setTab(id)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
        tab === id ? 'bg-ink3 text-white' : 'text-mist/70 hover:text-white'
      }`}
    >
      {label}
    </button>
  )

  return (
    <section
      aria-label={t('tutor.title')}
      className={`flex min-h-0 flex-col overflow-hidden rounded-2xl bg-ink2 text-mist ring-1 ring-white/10 ${className}`}
    >
      {/* header */}
      <header className="flex items-center gap-3 border-b border-white/10 p-4">
        <span className="grid size-10 place-items-center rounded-full bg-saudi text-white">
          <Bot className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{t('tutor.title')}</h2>
          <p className="text-xs text-mist/70">{t('tutor.role')}</p>
        </div>
      </header>

      <div role="tablist" className="mx-4 mt-3 flex gap-1 rounded-xl bg-ink p-1">
        {tabBtn('review', t('tutor.tab.review'))}
        {tabBtn('chat', t('tutor.tab.chat'))}
      </div>

      {/* ------------------------------------------------------------------ review */}
      {tab === 'review' && (
        <div id="tutor-panel-review" role="tabpanel" aria-labelledby="tutor-tab-review" className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
          <div className="flex items-center gap-3">
            <ScoreRing done={result.done} total={result.total} />
            <p className="text-sm text-white" aria-live="polite">
              {result.complete ? t('tutor.allClear') : t('tutor.score', { done: result.done, total: result.total })}
            </p>
          </div>

          {template.layout === 'esp32-hcsr04' && (

            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-ink p-3 text-sm">
            <input
              type="checkbox"
              checked={echoDivider}
              onChange={(e) => onEchoDividerChange(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#19B368]"
            />
            <span>
              <span className="block text-white">{t('tutor.divider')}</span>
              <span className="block text-xs text-mist/70">{t('tutor.dividerHelp')}</span>
            </span>
          </label>

          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-white">{t('tutor.steps')}</h3>
            <ol className="space-y-2">
              {template.steps.map((s) => {
                const state = result.steps[s.id]
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => highlight(`step-${s.id}`, s.pins)}
                      className="flex w-full items-start gap-3 rounded-xl border border-white/10 p-3 text-start transition-colors hover:bg-ink3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
                    >
                      <span className="mt-0.5">
                        <StepIcon state={state} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-white">{pick(s.title)}</span>
                          <span className={`text-xs ${STEP_STYLE[state]}`}>{t(`tutor.step.${state}` as DictKey)}</span>
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-mist/80">{pick(s.body)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </div>

          {realIssues.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-white">{t('tutor.issues')}</h3>
              <ul className="space-y-2">
                {realIssues.map((i) => {
                  const st = SEVERITY_STYLE[i.severity]
                  const Icon = st.icon
                  return (
                    <li key={i.id} className={`rounded-xl border-s-4 bg-ink p-3 ${st.ring}`}>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${st.chip}`}>
                        <Icon className="size-3" aria-hidden="true" />
                        {t(`tutor.severity.${i.severity}` as DictKey)}
                      </span>
                      <p className="mt-2 text-sm text-white">{pick(i.msg)}</p>
                      <p className="mt-1 text-xs leading-relaxed text-mist/80">
                        <span className="font-semibold text-mist">{t('tutor.fix')}: </span>
                        {pick(i.fix)}
                      </p>
                      <button
                        type="button"
                        onClick={() => highlight(i.id, i.pins)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-saudiBright hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
                      >
                        <LocateFixed className="size-3.5" aria-hidden="true" />
                        {t('tutor.highlight')}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ chat */}
      {tab === 'chat' && (
        <div id="tutor-panel-chat" role="tabpanel" aria-labelledby="tutor-tab-chat" className="flex min-h-0 flex-1 flex-col">
          <div role="log" aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[88%] space-y-1 rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.role === 'user' ? 'bg-saudi text-white' : 'bg-ink text-mist'
                  }`}
                >
                  {m.role === 'user' ? <p className="whitespace-pre-line">{m.text}</p> : <RichText text={render(m.text)} />}
                </div>
              </div>
            ))}
            {pending && <p className="text-xs text-mist/70">{t('tutor.thinking')}</p>}
            <div ref={endRef} />
          </div>

          <div className="flex flex-wrap gap-2 px-4 pb-2">
            {QUICK.filter((q) => template.layout === 'esp32-hcsr04' || q.key !== 'tutor.quick.echo').map((q) => (
              <button
                key={q.key}
                type="button"
                disabled={pending}
                onClick={() => void send(pick(q.ask))}
                className="rounded-full border border-white/15 px-3 py-1 text-xs text-mist transition-colors hover:bg-ink3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
              >
                {t(q.key)}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-white/10 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('tutor.placeholder')}
              aria-label={t('tutor.placeholder')}
              className="min-w-0 flex-1 rounded-xl bg-ink px-3 py-2 text-sm text-white placeholder:text-mist/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={t('tutor.send')}
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-saudi text-white transition-colors hover:bg-saudiBright disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
            >
              {/* mirrored automatically in RTL */}
              <SendHorizontal className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </form>
        </div>
      )}
    </section>
  )
}
