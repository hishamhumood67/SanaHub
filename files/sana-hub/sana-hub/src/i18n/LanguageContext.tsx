'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { dictionaries, type DictKey, type Lang, type Localized } from './dictionaries'

export const LANG_STORAGE_KEY = 'sanahub.lang'
const DIRECTIONS = { en: 'ltr', ar: 'rtl' } as const
export type Direction = (typeof DIRECTIONS)[Lang]

interface LanguageContextValue {
  lang: Lang
  dir: Direction
  isRTL: boolean
  /** false until the stored preference has been read on the client */
  ready: boolean
  setLang: (lang: Lang) => void
  toggleLang: () => void
  /** UI string lookup with {placeholder} interpolation */
  t: (key: DictKey, vars?: Record<string, string | number>) => string
  /** Choose the active-language value from curriculum / technical content */
  pick: <T>(value: Localized<T>) => T
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const isLang = (v: unknown): v is Lang => v === 'en' || v === 'ar'

function readStoredLang(): Lang | null {
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY)
    return isLang(v) ? v : null
  } catch {
    return null // private mode / blocked storage
  }
}

/**
 * Inline this in <head> (see app/layout.tsx) so `lang` and `dir` are correct
 * before first paint, avoiding a left-to-right flash for Arabic users.
 */
export const langBootScript = `(function(){try{var l=localStorage.getItem('${LANG_STORAGE_KEY}');if(l!=='ar'&&l!=='en'){l=((navigator.language||'').toLowerCase().indexOf('ar')===0)?'ar':'en'}var d=document.documentElement;d.lang=l;d.dir=l==='ar'?'rtl':'ltr'}catch(e){}})();`

export function LanguageProvider({
  children,
  defaultLang = 'en',
}: {
  children: ReactNode
  defaultLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(defaultLang)
  const [ready, setReady] = useState(false)

  // 1. Hydrate from LocalStorage (or the browser language on a first visit)
  useEffect(() => {
    const stored = readStoredLang()
    const fromBrowser: Lang = navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : defaultLang
    setLangState(stored ?? fromBrowser)
    setReady(true)
  }, [defaultLang])

  // 2. Keep <html lang dir> and LocalStorage in sync with state
  useEffect(() => {
    if (!ready) return
    const root = document.documentElement
    root.lang = lang
    root.dir = DIRECTIONS[lang]
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang, ready])

  // 3. Sync across browser tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY && isLang(e.newValue)) setLangState(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const toggleLang = useCallback(() => setLangState((l) => (l === 'en' ? 'ar' : 'en')), [])

  const t = useCallback<LanguageContextValue['t']>(
    (key, vars) => {
      let text: string = dictionaries[lang][key] ?? dictionaries.en[key] ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value))
        }
      }
      return text
    },
    [lang],
  )

  const pick = useCallback(<T,>(value: Localized<T>): T => value[lang], [lang])

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: DIRECTIONS[lang],
      isRTL: lang === 'ar',
      ready,
      setLang,
      toggleLang,
      t,
      pick,
    }),
    [lang, ready, setLang, toggleLang, t, pick],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside <LanguageProvider>')
  return ctx
}
