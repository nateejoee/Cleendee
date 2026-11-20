import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { localStorageGet, localStorageSet } from './i18n'

type Mode = 'system' | 'light' | 'dark'
const Theme = createContext<{ mode: Mode; setMode: (mode: Mode) => void }>({ mode: 'system', setMode: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(() => {
    const saved = localStorageGet('cd_appearance')
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  })
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    function apply() {
      const dark = mode === 'system' ? media.matches : mode === 'dark'
      const root = document.documentElement
      root.dataset.brand = 'navy'
      root.dataset.dark = dark ? '1' : ''
      root.style.colorScheme = dark ? 'dark' : 'light'
      document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#0F1C28' : '#13294B')
    }
    apply()
    media.addEventListener('change', apply)
    localStorageSet('cd_appearance', mode)
    return () => media.removeEventListener('change', apply)
  }, [mode])
  return <Theme.Provider value={{ mode, setMode }}>{children}</Theme.Provider>
}
export const useTheme = () => useContext(Theme)
