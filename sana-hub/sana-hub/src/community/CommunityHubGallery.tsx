'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { GitFork, Heart, Search, Star } from 'lucide-react'
import { useLanguage } from '@/i18n/LanguageContext'
import type { DictKey } from '@/i18n/dictionaries'
import { getCommunityRepository, type CommunityProject, type SortKey } from './communityStore'

export interface CommunityHubGalleryProps {
  /** called with a project the user chose to remix: the page loads its circuit into the canvas */
  onRemix: (project: CommunityProject) => void
  /** bump this number to force a reload (e.g. after publishing) */
  refreshKey?: number
  className?: string
}

const SORTS: SortKey[] = ['trending', 'newest', 'remixed']

function Thumbnail({ project }: { project: CommunityProject }) {
  const { t } = useLanguage()
  if (project.thumbnail) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={project.thumbnail} alt="" loading="lazy" className="aspect-video w-full object-cover" />
  }
  // Generated placeholder when there is no snapshot: hue comes from the project id so cards look distinct
  const hue = [...project.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0)
  return (
    <div
      className="grid aspect-video w-full place-items-center text-sm font-semibold text-white/90"
      style={{ background: `linear-gradient(135deg, hsl(${hue} 45% 22%), hsl(${(hue + 40) % 360} 55% 32%))` }}
    >
      {t(`layout.${project.circuit.layout}` as DictKey)}
    </div>
  )
}

function ActionButton({
  active,
  count,
  label,
  onClick,
  children,
}: {
  active?: boolean
  count?: number
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
        active ? 'border-saudiBright bg-saudi/25 text-white' : 'border-white/15 text-mist hover:bg-ink3'
      }`}
    >
      {children}
      {count !== undefined && <span>{count}</span>}
    </button>
  )
}

export default function CommunityHubGallery({ onRemix, refreshKey = 0, className = '' }: CommunityHubGalleryProps) {
  const { t, lang } = useLanguage()
  const [items, setItems] = useState<CommunityProject[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState<string | undefined>()
  const [sort, setSort] = useState<SortKey>('trending')
  const [loading, setLoading] = useState(true)

  const repo = getCommunityRepository()

  // tag chips come from the unfiltered list
  useEffect(() => {
    let live = true
    repo.list({}).then((all) => {
      if (live) setAllTags([...new Set(all.flatMap((p) => p.tags))].sort())
    })
    return () => {
      live = false
    }
  }, [repo, refreshKey])

  useEffect(() => {
    let live = true
    setLoading(true)
    repo.list({ search, tag, sort }).then((res) => {
      if (!live) return
      setItems(res)
      setLoading(false)
    })
    return () => {
      live = false
    }
  }, [repo, search, tag, sort, refreshKey])

  const replace = useCallback((next: CommunityProject) => setItems((cur) => cur.map((p) => (p.id === next.id ? next : p))), [])
  const like = (p: CommunityProject) => repo.toggleLike(p.id).then(replace)
  const star = (p: CommunityProject) => repo.toggleStar(p.id).then(replace)

  // 'ar-SA' defaults to the Hijri calendar, so ask for Gregorian explicitly
  const date = useMemo(
    () => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory' : 'en-GB', { dateStyle: 'medium' }),
    [lang],
  )

  return (
    <section aria-labelledby="community-title" className={`min-h-0 space-y-4 overflow-y-auto rounded-2xl bg-ink2 p-4 text-mist ring-1 ring-white/10 ${className}`}>
      <header>
        <h2 id="community-title" className="text-xl font-semibold text-white">
          {t('community.title')}
        </h2>
        <p className="text-sm text-mist/80">{t('community.subtitle')}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-mist/60" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('community.search')}
            aria-label={t('community.search')}
            className="w-full rounded-xl bg-ink py-2 pe-3 ps-9 text-sm text-white placeholder:text-mist/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
          />
        </label>
        <label className="flex items-center gap-2 text-xs">
          <span className="text-mist/70">{t('community.sort')}</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg bg-ink px-2 py-1.5 text-sm text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`community.sort.${s}` as DictKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Tags">
        {[undefined, ...allTags].map((x) => (
          <button
            key={x ?? '__all'}
            type="button"
            aria-pressed={tag === x}
            onClick={() => setTag(x)}
            className={`rounded-full px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
              tag === x ? 'bg-saudi text-white' : 'border border-white/15 hover:bg-ink3'
            }`}
          >
            {x ? `#${x}` : t('community.all')}
          </button>
        ))}
      </div>

      {!loading && items.length === 0 ? (
        <p className="py-10 text-center text-sm text-mist/70">{t('community.empty')}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <li key={p.id} className="flex flex-col overflow-hidden rounded-2xl bg-ink ring-1 ring-white/10">
              <Thumbnail project={p} />
              <div className="flex flex-1 flex-col gap-2 p-3">
                <div>
                  <h3 className="font-semibold text-white">{p.title}</h3>
                  <p className="text-xs text-mist/70">
                    {t('community.by', { name: p.author.name })} · {date.format(new Date(p.createdAt))}
                  </p>
                </div>
                {p.description && <p className="line-clamp-3 text-sm text-mist/90">{p.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((x) => (
                    <button key={x} type="button" onClick={() => setTag(x)} className="rounded-full bg-ink3 px-2 py-0.5 text-xs hover:text-white">
                      #{x}
                    </button>
                  ))}
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  <ActionButton active={p.viewer.liked} count={p.likes} label={t('community.like')} onClick={() => void like(p)}>
                    <Heart className={`size-3.5 ${p.viewer.liked ? 'fill-current' : ''}`} aria-hidden="true" />
                  </ActionButton>
                  <ActionButton active={p.viewer.starred} count={p.stars} label={t('community.star')} onClick={() => void star(p)}>
                    <Star className={`size-3.5 ${p.viewer.starred ? 'fill-current' : ''}`} aria-hidden="true" />
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() => onRemix(p)}
                    className="ms-auto inline-flex items-center gap-1.5 rounded-full bg-saudi px-3 py-1 text-xs text-white hover:bg-saudiBright focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright"
                  >
                    <GitFork className="size-3.5" aria-hidden="true" />
                    {t('community.remix')} · {p.remixes}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
