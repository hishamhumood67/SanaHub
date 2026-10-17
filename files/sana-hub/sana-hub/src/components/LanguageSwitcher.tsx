'use client'

import { useLanguage } from '@/i18n/LanguageContext'

export default function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage()

  const item = (code: 'en' | 'ar', label: string, htmlLang: string) => (
    <button
      type="button"
      lang={htmlLang}
      aria-pressed={lang === code}
      onClick={() => setLang(code)}
      className={`px-3 py-1 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-saudiBright ${
        lang === code ? 'bg-saudi text-white' : 'text-mist hover:bg-ink3'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      role="group"
      aria-label={t('header.langSwitch')}
      // dir=ltr keeps "EN | عربي" in the same visual order in both languages
      dir="ltr"
      className="inline-flex overflow-hidden rounded-full ring-1 ring-white/20"
    >
      {item('en', 'EN', 'en')}
      {item('ar', 'عربي', 'ar')}
    </div>
  )
}
