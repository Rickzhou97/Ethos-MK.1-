"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"

export type ThemeMode = "light" | "cyberpunk" | "sage"

type LayoutContextType = {
  collapsed: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
}

const LayoutContext = createContext<LayoutContextType>({
  collapsed: false,
  setCollapsed: () => {},
  toggleCollapsed: () => {},
  theme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
})

export function useLayout() {
  return useContext(LayoutContext)
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState<ThemeMode>("light")

  // Load theme from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("ethos-theme") as ThemeMode | null
    if (saved === "cyberpunk" || saved === "sage") {
      setTheme(saved)
    }
  }, [])

  // Apply theme class to <html> and persist
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove("cyberpunk", "sage")
    document.body.classList.remove("cyberpunk-scanline")

    if (theme === "cyberpunk") {
      html.classList.add("cyberpunk")
      document.body.classList.add("cyberpunk-scanline")
    } else if (theme === "sage") {
      html.classList.add("sage")
    }
    localStorage.setItem("ethos-theme", theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "cyberpunk" : "light"))
  }

  return (
    <LayoutContext.Provider
      value={{
        collapsed,
        setCollapsed,
        toggleCollapsed: () => setCollapsed(!collapsed),
        theme,
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </LayoutContext.Provider>
  )
}
