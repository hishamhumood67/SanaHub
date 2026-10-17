import type { Config } from 'tailwindcss'

// Tailwind 3.4: logical utilities (start-*, end-*, ms-*, me-*, ps-*, text-start, border-s)
// and the rtl: / ltr: variants flip automatically with <html dir>.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0E1A2B', // board-room navy: canvas and page background
        ink2: '#152640', // panels
        ink3: '#1D3454', // hover / selected surfaces
        mist: '#C9D6E6', // body text on dark
        saudi: '#0B7A43', // flag green: primary actions
        saudiBright: '#19B368', // focus rings, success
        copper: '#D08A3C', // warnings, copper traces
        alert: '#E5534B', // errors
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
