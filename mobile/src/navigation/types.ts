import type { NativeStackScreenProps } from '@react-navigation/native-stack'

export type RootStackParamList = {
  Login: { message?: string } | undefined
  Register: undefined
  ForgotPassword: undefined
  ResetPassword: { email: string; code?: string }
  Tabs: undefined
}

export type TabParamList = {
  Timer: undefined
  Timeline: undefined
  Insights: undefined
  Settings: undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>
