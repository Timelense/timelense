// TimeLens — "Soft Play" design language.
// Soft & friendly, chunky & characterful. Full light + dark token sets,
// plus a ThemeProvider/useTheme hook for runtime switching.
import React, { createContext, useContext, useMemo, useState } from 'react'
import { useColorScheme } from 'react-native'

// ── Palettes ────────────────────────────────────────────────────────────────
// Warm cream surfaces + friendly violet, soft pastel categories.
export const lightColors = {
  primary: '#7C6BF5', // friendly violet
  primaryDark: '#6354E0',
  primaryLight: '#ECE9FE', // soft violet wash — accent surfaces
  accent: '#6C5CE7', // punchier violet — links, score, highlights

  productive: '#2FC79B', // mint
  nonProductive: '#FF8A6B', // coral
  neutral: '#C7C2D2', // warm grey-lilac

  background: '#FFF8F1', // warm cream
  surface: '#FFFFFF', // clean white cards
  surfaceRaised: '#FBF4FF', // soft lilac tint — inputs, chips
  border: '#F0E8DD',
  divider: '#F2ECE3',

  text: '#2B2540', // deep plum-ink (softer than pure black)
  textSecondary: '#6F6880',
  textMuted: '#A39BB1',

  danger: '#FF6B6B',
  warning: '#FFB020',
  success: '#2FC79B',

  white: '#FFFFFF',
  black: '#000000',
} as const

export type Palette = { readonly [K in keyof typeof lightColors]: string }

export const darkColors: Palette = {
  primary: '#9C8BFF', // brighter violet on dark
  primaryDark: '#7C6BF5',
  primaryLight: '#372D5B',
  accent: '#A99BFF',

  productive: '#4FD9B0',
  nonProductive: '#FF9E85',
  neutral: '#6E6886',

  background: '#1C1830', // deep plum ink
  surface: '#28213C',
  surfaceRaised: '#312847',
  border: '#3B3357',
  divider: '#332B4D',

  text: '#F4F0FB',
  textSecondary: '#B5ADC9',
  textMuted: '#7E7596',

  danger: '#FF7A7A',
  warning: '#FFC04D',
  success: '#4FD9B0',

  white: '#FFFFFF',
  black: '#000000',
}

// Back-compat default export (light). Files not yet reading the hook still
// pick up the new look in light mode.
export const colors = lightColors

// ── Spacing ───────────────────────────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

// ── Typography ──────────────────────────────────────────────────────────────
// Chunky & characterful: heavier default weights, room for oversized numbers.
export const typography = {
  size: {
    xs: 12,
    sm: 13,
    md: 15,
    lg: 18,
    xl: 22,
    xxl: 30,
    xxxl: 40,
  },
  weight: {
    regular: '500' as const, // base sits a touch heavier than usual
    medium: '600' as const,
    semibold: '700' as const,
    bold: '800' as const,
    heavy: '900' as const,
  },
} as const

// ── Fonts ───────────────────────────────────────────────────────────────────
// Fredoka — rounded, chunky, characterful. Files live in mobile/assets/fonts and
// are linked via react-native.config.js (run `npx react-native-asset`, then rebuild).
// The PostScript names below match the filenames, so they resolve on iOS + Android.
export const fonts = {
  regular: 'Fredoka-Regular',
  medium: 'Fredoka-Medium',
  semibold: 'Fredoka-SemiBold',
  bold: 'Fredoka-Bold',
} as const

// ── Radius ──────────────────────────────────────────────────────────────────
// Big, soft, pillowy corners.
export const radius = {
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const

// ── Shadows ───────────────────────────────────────────────────────────────
// Soft floating cards + a toy-like "drop" under primary buttons.
export const shadow = {
  card: {
    shadowColor: '#2B2540',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
  button: (tint: string) => ({
    shadowColor: tint,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  }),
} as const

// Brighter pastel hues for category dots/bars (hold up in both modes)
export const categoryPalette = [
  '#7C6BF5', // violet
  '#2FC79B', // mint
  '#FF8A6B', // coral
  '#FFC93C', // lemon
  '#6FB7FF', // sky
  '#FF9EC4', // blush
  '#5BD1B0', // teal
  '#B9A8FF', // lilac
] as const

// ── Rainbow (Playful & colourful concept) ───────────────────────────────────
// The signature multi-hue sweep that runs through every screen: the big timer
// button, the spinning score ring, the brand dot. The dark set swaps the lead
// violet for its brighter on-dark variant. Loops back to its first stop so it
// reads continuously when used as a conic/looping gradient.
export const rainbow = {
  light: ['#7C6BF5', '#6FB7FF', '#5BD1B0', '#FFC93C', '#FF8A6B', '#FF9EC4'],
  dark: ['#9C8BFF', '#6FB7FF', '#5BD1B0', '#FFC93C', '#FF8A6B', '#FF9EC4'],
} as const

// Vertical ribbon stops (top → bottom) for the timeline spine.
export const ribbonStops = {
  light: ['#7C6BF5', '#6FB7FF', '#5BD1B0', '#FFC93C', '#FF8A6B'],
  dark: ['#9C8BFF', '#6FB7FF', '#5BD1B0', '#FFC93C', '#FF8A6B'],
} as const

// Convenience: pick the right rainbow/ribbon set for a resolved scheme.
export const rainbowFor = (scheme: 'light' | 'dark') => rainbow[scheme]
export const ribbonFor = (scheme: 'light' | 'dark') => ribbonStops[scheme]

// ── Theme context ─────────────────────────────────────────────────────────
type Scheme = 'light' | 'dark'
export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeContextValue {
  colors: Palette
  scheme: Scheme
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme()
  const [preference, setPreference] = useState<ThemePreference>('system')

  const scheme: Scheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo<ThemeContextValue>(() => {
    const resolved: Scheme = scheme
    return {
      colors: resolved === 'dark' ? darkColors : lightColors,
      scheme: resolved,
      preference,
      setPreference,
      toggle: () => setPreference(resolved === 'dark' ? 'light' : 'dark'),
    }
  }, [scheme, preference])

  return React.createElement(ThemeContext.Provider, { value }, children)
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Safe fallback before the provider mounts.
    return {
      colors: lightColors,
      scheme: 'light',
      preference: 'system',
      setPreference: () => {},
      toggle: () => {},
    }
  }
  return ctx
}
