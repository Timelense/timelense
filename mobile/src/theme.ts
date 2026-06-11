export const colors = {
  primary: '#4A90D9',
  primaryDark: '#2C5282',
  primaryLight: '#EBF4FF',

  productive: '#48BB78',
  nonProductive: '#FC8181',
  neutral: '#A0AEC0',

  background: '#F7FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  divider: '#EDF2F7',

  text: '#1A202C',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',

  danger: '#E53E3E',
  warning: '#DD6B20',
  success: '#38A169',

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

export const categoryPalette = [
  '#4A90D9',
  '#48BB78',
  '#FC8181',
  '#F6AD55',
  '#805AD5',
  '#2C5282',
  '#38A169',
  '#E53E3E',
] as const
