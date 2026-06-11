// Dark theme — slate surfaces with indigo/violet accents.
export const colors = {
  primary: '#6366F1', // indigo-500
  primaryDark: '#4F46E5', // indigo-600
  primaryLight: '#312E81', // deep indigo — subtle accent surfaces on dark
  accent: '#A78BFA', // violet-400

  productive: '#34D399', // emerald-400
  nonProductive: '#F87171', // red-400
  neutral: '#64748B', // slate-500

  background: '#0B1120', // near-black slate
  surface: '#151E31', // slate card
  surfaceRaised: '#1E293B', // slate-800 — inputs, chips
  border: '#28344A',
  divider: '#1E2A41',

  text: '#F1F5F9', // slate-100
  textSecondary: '#94A3B8', // slate-400
  textMuted: '#5B6B84',

  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',

  white: '#FFFFFF',
  black: '#000000',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const

export const typography = {
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
    xxxl: 36,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
} as const

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
} as const

// Brighter hues that hold up on dark backgrounds
export const categoryPalette = [
  '#818CF8', // indigo
  '#34D399', // emerald
  '#F87171', // red
  '#FBBF24', // amber
  '#A78BFA', // violet
  '#38BDF8', // sky
  '#FB923C', // orange
  '#F472B6', // pink
] as const
