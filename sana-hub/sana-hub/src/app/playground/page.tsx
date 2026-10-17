'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import SanaAiDiagnosticPanel from '@/ai-tutor/SanaAiDiagnosticPanel'
import SanaCanvas3D, { type SanaCanvas3DHandle } from '@/3d-components/SanaCanvas3D'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import CommunityHubGallery from '@/community/CommunityHubGallery'
import ShareDialog from '@/community/ShareDialog'
import type { CommunityProject } from '@/community/communityStore'
import { documentToWires, parseCircuit } from '@/community/projectSchema'
import { useLanguage } from '@/i18n/LanguageContext'
import type { DictKey } from '@/i18n/dictionaries'
import { evaluateCircuit, type LayoutId, type Wire } from '@/simulators/circuitEvaluator'
import type { PinKey } from '@/simulators/pinCatalog'
import { TEMPLATES } from '@/templates'

type Tab = 'playground' | 'community'
const LAYOUT_IDS: LayoutId[] = ['esp32-hcsr04', 'mindstorms']

export default function PlaygroundPage() {
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('playground')
  const [layoutId, setLayoutId] = useState<LayoutId>('esp32-hcsr04')
  const [wires, setWires] = useState<Wire[]>([])
  const [echoDivider, setEchoDivider] = useState(false)
  const [highlight, setHighlight] = useState<PinKey[]>([])
  const [shareOpen, setShareOpen] = useState(false)
  const [remixOf, setRemixOf] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<DictKey | null>(null)
  const canvasRef = useRef<SanaCanvas3DHandle>(null)

  const template = TEMPLATES[layoutId]
  // One evaluation feeds both the 3D rings and the SANA AI panel
  const result = useMemo(() => evaluateCircuit(layoutId, wires, { echoDivider }), [layoutId, wires, echoDivider])

  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  const changeLayout = (id: LayoutId) => {
    if (id === layoutId) return
    setLayoutId(id)
    setWires([])
    setHighlight([])
    setRemixOf(null)
  }

  const handleRemix = (project: CommunityProject) => {
    const parsed = parseCircuit(project.circuit) // never trust stored JSON
    if (!parsed.ok) return setToast('community.badRemix')
    setLayoutId(parsed.doc.layout)
    setWires(documentToWires(parsed.doc))
    setEchoDivider(parsed.doc.options.echoDivider)
    setHighlight([])
    setRemixOf(project.id)
    setTab('playground')
    setToast('community.remixDone')
  }

  const getSnapshot = useCallback(() => canvasRef.current?.snapshot() ?? null, [])

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === id}
      onClick={() => setTab(id)}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
        tab === id ? 'bg-saudi text-white' : 'text-mist hover:bg-ink3'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex min-h-dvh flex-col bg-ink text-mist">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-tight text-white">{t('brand.name')}</p>
          <p className="truncate text-xs text-mist/70">{t('brand.tagline')}</p>
        </div>
        <div role="tablist" className="flex gap-1 rounded-full bg-ink2 p-1">
          {tabBtn('playground', t('nav.playground'))}
          {tabBtn('community', t('nav.community'))}
        </div>
        <LanguageSwitcher />
      </header>

      {tab === 'playground' ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3">
            <div role="group" aria-label={t('layout.label')} className="flex flex-wrap items-center gap-2">
              {LAYOUT_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={layoutId === id}
                  onClick={() => changeLayout(id)}
                  className={`rounded-full border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
                    layoutId === id ? 'border-saudiBright bg-saudi/25 text-white' : 'border-white/15 hover:bg-ink3'
                  }`}
                >
                  {t(`layout.${id}` as DictKey)}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-saudi px-4 py-1.5 text-sm text-white hover:bg-saudiBright focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
            >
              <Share2 className="size-4" aria-hidden="true" />
              {t('share.open')}
            </button>
          </div>

          {/* The grid follows the document direction, so the tutor sits on the left in Arabic automatically */}
          <main className="grid flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
            <SanaCanvas3D
              ref={canvasRef}
              className="min-h-[60dvh] lg:min-h-0"
              layoutId={layoutId}
              wires={wires}
              onWiresChange={setWires}
              flaggedPins={result.flagged}
              highlightPins={highlight}
            />
            <SanaAiDiagnosticPanel
              key={layoutId}
              className="max-h-[80dvh] lg:max-h-[calc(100dvh-9.5rem)]"
              template={template}
              result={result}
              echoDivider={echoDivider}
              onEchoDividerChange={setEchoDivider}
              onHighlight={setHighlight}
            />
          </main>
        </>
      ) : (
        <main className="flex-1 p-4">
          <CommunityHubGallery className="max-h-[calc(100dvh-7rem)]" onRemix={handleRemix} refreshKey={refreshKey} />
        </main>
      )}

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        layoutId={layoutId}
        wires={wires}
        echoDivider={echoDivider}
        getSnapshot={getSnapshot}
        remixOf={remixOf}
        onPublished={() => {
          setRemixOf(null)
          setRefreshKey((k) => k + 1)
        }}
      />

      {toast && (
        <p role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto w-fit max-w-md rounded-xl bg-ink3 px-4 py-2 text-sm text-white shadow-lg ring-1 ring-white/15">
          {t(toast)}
        </p>
      )}
    </div>
  )
}
