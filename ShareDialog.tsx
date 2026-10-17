'use client'

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'
import type { LayoutId, Wire } from '@/simulators/circuitEvaluator'
import { currentAuthor, getCommunityRepository, type CommunityProject } from './communityStore'
import { serializeCircuit } from './projectSchema'

export interface ShareDialogProps {
  open: boolean
  onClose: () => void
  layoutId: LayoutId
  wires: Wire[]
  echoDivider: boolean
  /** returns a JPEG data URL of the 3D view (SanaCanvas3D handle.snapshot) */
  getSnapshot: () => string | null
  /** set when the circuit started as a remix: the original gets credit and a remix count */
  remixOf?: string | null
  onPublished?: (project: CommunityProject) => void
}

const MAX_TAGS = 5

const field =
  'w-full rounded-xl bg-ink px-3 py-2 text-sm text-white placeholder:text-mist/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright'

export default function ShareDialog({ open, onClose, layoutId, wires, echoDivider, getSnapshot, remixOf, onPublished }: ShareDialogProps) {
  const { t } = useLanguage()
  const dialog = useRef<HTMLDialogElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [thumb, setThumb] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  // Open/close the native <dialog> (gives focus trapping, Esc to close and a backdrop for free)
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      setThumb(getSnapshot())
      setError(null)
      setDone(false)
    } else if (!open && d.open) {
      d.close()
    }
  }, [open, getSnapshot])

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '').slice(0, 24)
    if (tag && !tags.includes(tag) && tags.length < MAX_TAGS) setTags([...tags, tag])
    setTagInput('')
  }

  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(tags.slice(0, -1))
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (wires.length === 0) return setError(t('share.needWires'))
    if (title.trim().length < 3) return setError(t('share.errTitle'))
    setBusy(true)
    setError(null)
    try {
      const pending = tagInput ? [...tags, tagInput.trim().toLowerCase()] : tags
      const project = await getCommunityRepository().publish(
        {
          title,
          description,
          tags: pending.slice(0, MAX_TAGS),
          thumbnail: thumb,
          circuit: serializeCircuit(layoutId, wires, { echoDivider }),
          remixOf,
        },
        currentAuthor(),
      )
      setDone(true)
      setTitle('')
      setDescription('')
      setTags([])
      setTagInput('')
      onPublished?.(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-labelledby="share-title"
      className="m-auto w-[min(92vw,34rem)] rounded-2xl bg-ink2 p-0 text-mist ring-1 ring-white/10 backdrop:bg-black/70"
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <header className="flex items-center justify-between gap-3">
          <h2 id="share-title" className="text-lg font-semibold text-white">
            {t('share.title')}
          </h2>
          <button type="button" onClick={onClose} aria-label={t('share.close')} className="rounded-full p-1 hover:bg-ink3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright">
            <X className="size-5" aria-hidden="true" />
          </button>
        </header>

        {done ? (
          <div className="space-y-4">
            <p role="status" className="rounded-xl bg-saudi/20 p-3 text-sm text-white">
              {t('share.done')}
            </p>
            <button type="button" onClick={onClose} className="rounded-xl bg-saudi px-4 py-2 text-sm text-white hover:bg-saudiBright focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright">
              {t('share.close')}
            </button>
          </div>
        ) : (
          <>
            <div>
              <p className="mb-1 text-xs text-mist/70">{t('share.preview')}</p>
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="aspect-video w-full rounded-xl object-cover ring-1 ring-white/10" />
              ) : (
                <div className="aspect-video w-full rounded-xl bg-ink ring-1 ring-white/10" />
              )}
            </div>

            {remixOf && <p className="text-xs text-saudiBright">{t('share.remixNote')}</p>}

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-mist/70">{t('share.name')}</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} required className={field} />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-xs text-mist/70">{t('share.desc')}</span>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} rows={3} className={field} />
            </label>

            <div className="text-sm">
              <label htmlFor="share-tags" className="mb-1 block text-xs text-mist/70">
                {t('share.tags')}
              </label>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-ink p-2">
                {tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-ink3 px-2 py-0.5 text-xs text-white">
                    #{tag}
                    <button type="button" onClick={() => setTags(tags.filter((x) => x !== tag))} aria-label={`${t('share.cancel')} ${tag}`} className="hover:text-alert">
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                {tags.length < MAX_TAGS && (
                  <input
                    id="share-tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={onTagKey}
                    onBlur={() => tagInput && addTag(tagInput)}
                    className="min-w-24 flex-1 bg-transparent px-1 py-0.5 text-sm text-white focus-visible:outline-none"
                  />
                )}
              </div>
            </div>

            {error && (
              <p role="alert" className="text-sm text-alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm hover:bg-ink3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright">
                {t('share.cancel')}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-saudi px-4 py-2 text-sm text-white hover:bg-saudiBright disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
              >
                {t('share.publish')}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  )
}
