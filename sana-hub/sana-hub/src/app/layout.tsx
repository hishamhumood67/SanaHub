import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans_Arabic } from 'next/font/google'
import { LanguageProvider, langBootScript } from '@/i18n/LanguageContext'
import './globals.css'

// One family covers Latin and Arabic, so the two languages share the same voice.
const sans = IBM_Plex_Sans_Arabic({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'SANA HUB',
  description: 'Where Saudi Makers Build the Future | صنع في السعودية · هَبْ الهندسة التفاعلية',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang/dir are corrected before paint by the boot script, then owned by LanguageProvider
    <html lang="en" dir="ltr" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: langBootScript }} />
      </head>
      <body className="font-sans antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
