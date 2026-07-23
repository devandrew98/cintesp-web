import { create } from 'zustand'

type Theme = 'light' | 'dark'

const THEME_KEY = 'cintesp:theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Aplica a classe .dark no <html> conforme o tema salvo. Chamado no boot. */
export function applyStoredTheme() {
  const theme = getInitialTheme()
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface UIState {
  theme: Theme
  sidebarOpen: boolean // usado no mobile (drawer)
  sidebarCollapsed: boolean // usado no desktop (recolhido)
  toggleTheme: () => void
  setSidebarOpen: (open: boolean) => void
  toggleSidebarCollapsed: () => void
}

export const useUI = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  sidebarOpen: false,
  sidebarCollapsed: false,
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(THEME_KEY, next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    set({ theme: next })
  },
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))
