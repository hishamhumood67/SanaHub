/**
 * Community data layer. The UI only talks to `CommunityRepository`.
 * Today it is backed by LocalStorage (a working demo with seed projects).
 * Later, write a SupabaseRepository with the same interface and return it from
 * getCommunityRepository(): no component has to change. See CODE_OVERVIEW_GUIDE.md.
 */
import type { LayoutId } from '@/simulators/circuitEvaluator'
import { SCHEMA_ID, SCHEMA_VERSION, parseCircuit, type CircuitDocument } from './projectSchema'

export interface Author {
  id: string
  name: string
}

export interface CommunityProject {
  id: string
  title: string
  description: string
  tags: string[]
  author: Author
  createdAt: string
  /** JPEG data URL here; with Supabase this becomes a Storage URL */
  thumbnail: string | null
  circuit: CircuitDocument
  likes: number
  stars: number
  remixes: number
  remixOf: string | null
  viewer: { liked: boolean; starred: boolean }
}

export type SortKey = 'trending' | 'newest' | 'remixed'
export interface ListQuery {
  search?: string
  tag?: string
  sort?: SortKey
}
export interface PublishInput {
  title: string
  description: string
  tags: string[]
  thumbnail: string | null
  circuit: CircuitDocument
  remixOf?: string | null
}

export interface CommunityRepository {
  list(query: ListQuery): Promise<CommunityProject[]>
  publish(input: PublishInput, author: Author): Promise<CommunityProject>
  toggleLike(id: string): Promise<CommunityProject>
  toggleStar(id: string): Promise<CommunityProject>
}

/** Replace with the signed-in Supabase / NextAuth user once authentication exists. */
export const currentAuthor = (): Author => ({ id: 'guest', name: 'Guest maker' })

/* ------------------------------------------------------------------ local implementation */

type StoredProject = Omit<CommunityProject, 'viewer'>
interface StoredState {
  projects: StoredProject[]
  likes: string[]
  stars: string[]
}
const KEY = 'sanahub.community.v1'

const doc = (layout: LayoutId, pairs: Array<[string, string]>, echoDivider = false): CircuitDocument => ({
  schema: SCHEMA_ID,
  version: SCHEMA_VERSION,
  layout,
  wires: pairs.map(([a, b]) => ({ a, b })) as CircuitDocument['wires'],
  options: { echoDivider },
})

const ESP_BASE: Array<[string, string]> = [
  ['hcsr04:GND', 'esp32:GND1'],
  ['hcsr04:VCC', 'esp32:VIN'],
]

function seedProjects(): StoredProject[] {
  const mk = (p: Omit<StoredProject, 'thumbnail' | 'remixOf' | 'description'> & { description: string }): StoredProject => ({
    ...p,
    thumbnail: null,
    remixOf: null,
  })
  return [
    mk({
      id: 'seed-farm',
      title: 'Smart Farm Distance Alarm',
      description: 'Measures the water level in a tank with an HC-SR04 and warns when it drops. Safe 3.3 V echo divider included.',
      tags: ['iot', 'agriculture', 'esp32'],
      author: { id: 'seed-1', name: 'Noura A.' },
      createdAt: '2026-09-28T10:00:00Z',
      circuit: doc('esp32-hcsr04', [...ESP_BASE, ['hcsr04:TRIG', 'esp32:D18'], ['hcsr04:ECHO', 'esp32:D19']], true),
      likes: 42,
      stars: 17,
      remixes: 6,
    }),
    mk({
      id: 'seed-parking',
      title: 'Parking Assistant',
      description: 'Distance sensor on GPIO23 and GPIO19 for a garage wall. Remix it to add a buzzer.',
      tags: ['automotive', 'ultrasonic', 'esp32'],
      author: { id: 'seed-2', name: 'Faisal K.' },
      createdAt: '2026-10-05T14:30:00Z',
      circuit: doc('esp32-hcsr04', [...ESP_BASE, ['hcsr04:TRIG', 'esp32:D23'], ['hcsr04:ECHO', 'esp32:D19']], true),
      likes: 31,
      stars: 9,
      remixes: 3,
    }),
    mk({
      id: 'seed-ev3',
      title: 'EV3 Obstacle Stopper',
      description: 'A motor on port A drives until the ultrasonic sensor on port 1 sees something close. Color sensor on port 2.',
      tags: ['robotics', 'mindstorms', 'beginner'],
      author: { id: 'seed-3', name: 'Reem S.' },
      createdAt: '2026-10-09T09:15:00Z',
      circuit: doc('mindstorms', [['motor:CON', 'ev3:A'], ['ultra:CON', 'ev3:1'], ['color:CON', 'ev3:2']]),
      likes: 58,
      stars: 24,
      remixes: 11,
    }),
    mk({
      id: 'seed-debug',
      title: 'Debug Me: Why is TRIG silent?',
      description: 'A deliberately broken circuit for practice. Open it, ask SANA AI what is wrong, and fix it.',
      tags: ['debug', 'learning', 'esp32'],
      author: { id: 'seed-4', name: 'Omar H.' },
      createdAt: '2026-10-12T18:45:00Z',
      circuit: doc('esp32-hcsr04', [...ESP_BASE, ['hcsr04:TRIG', 'esp32:D34'], ['hcsr04:ECHO', 'esp32:D19']], false),
      likes: 19,
      stars: 12,
      remixes: 14,
    }),
  ]
}

function load(): StoredState {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as StoredState
      if (Array.isArray(parsed.projects)) return { projects: parsed.projects, likes: parsed.likes ?? [], stars: parsed.stars ?? [] }
    }
  } catch {
    /* fall through to seeds */
  }
  return { projects: seedProjects(), likes: [], stars: [] }
}

function save(state: StoredState) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded (thumbnails are large): drop thumbnails of user projects and retry once.
    try {
      const slim = { ...state, projects: state.projects.map((p) => (p.id.startsWith('seed-') ? p : { ...p, thumbnail: null })) }
      window.localStorage.setItem(KEY, JSON.stringify(slim))
    } catch {
      /* give up silently: the demo store is best-effort */
    }
  }
}

const withViewer = (p: StoredProject, s: StoredState): CommunityProject => ({
  ...p,
  viewer: { liked: s.likes.includes(p.id), starred: s.stars.includes(p.id) },
})

const score = (p: StoredProject) => p.likes + 2 * p.stars + 3 * p.remixes
const clean = (s: string, max: number) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

function createLocalRepository(): CommunityRepository {
  const toggle = async (id: string, field: 'likes' | 'stars'): Promise<CommunityProject> => {
    const s = load()
    const p = s.projects.find((x) => x.id === id)
    if (!p) throw new Error('Project not found.')
    const set = field === 'likes' ? s.likes : s.stars
    const i = set.indexOf(id)
    if (i >= 0) {
      set.splice(i, 1)
      p[field] = Math.max(0, p[field] - 1)
    } else {
      set.push(id)
      p[field] += 1
    }
    save(s)
    return withViewer(p, s)
  }

  return {
    async list({ search = '', tag, sort = 'trending' }) {
      const s = load()
      const q = search.trim().toLowerCase()
      return s.projects
        .filter((p) => !tag || p.tags.includes(tag))
        .filter((p) => !q || [p.title, p.description, p.author.name, ...p.tags].join(' ').toLowerCase().includes(q))
        .sort((a, b) =>
          sort === 'newest' ? b.createdAt.localeCompare(a.createdAt) : sort === 'remixed' ? b.remixes - a.remixes : score(b) - score(a),
        )
        .map((p) => withViewer(p, s))
    },

    async publish(input, author) {
      const checked = parseCircuit(JSON.parse(JSON.stringify(input.circuit)))
      if (!checked.ok) throw new Error(checked.error)
      const title = clean(input.title, 80)
      if (title.length < 3) throw new Error('Title is too short.')
      const s = load()
      const project: StoredProject = {
        id: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        title,
        description: clean(input.description, 600),
        tags: [...new Set(input.tags.map((t) => clean(t, 24).toLowerCase()).filter(Boolean))].slice(0, 5),
        author,
        createdAt: new Date().toISOString(),
        thumbnail: input.thumbnail,
        circuit: checked.doc,
        likes: 0,
        stars: 0,
        remixes: 0,
        remixOf: input.remixOf ?? null,
      }
      const parent = project.remixOf ? s.projects.find((p) => p.id === project.remixOf) : undefined
      if (parent) parent.remixes += 1 // a remix counts once it is published
      s.projects.unshift(project)
      save(s)
      return withViewer(project, s)
    },

    toggleLike: (id) => toggle(id, 'likes'),
    toggleStar: (id) => toggle(id, 'stars'),
  }
}

let repo: CommunityRepository | null = null
/** The single place that decides which backend the app uses. */
export function getCommunityRepository(): CommunityRepository {
  return (repo ??= createLocalRepository())
}
