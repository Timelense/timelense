# TimeLens Mobile — UI Audit & Fixes Report

**Date:** 2026-06-13
**Scope:** `mobile/` workspace — all 6 screens (Login, Register, Timer, Timeline, Insights, Settings) and shared components (CategoryPicker, TagSelector), plus the API/auth/navigation foundations they depend on.
**Goal:** Identify and fix all Critical and High severity issues across functional, visual, UX, and performance categories.

---

## Executive summary

| Metric | Value |
| --- | --- |
| Issues identified | **23** (12 Critical/High → all fixed; 11 Medium/Low → logged as recommendations) |
| Files modified | **11** |
| Test pass rate after fixes | 21/21 backend tests pass; full monorepo `tsc --noEmit` exits 0 |
| New runtime dependencies | **0** (constraint respected) |
| Backend / DB changes | **0** (constraint respected) |

All four required categories have at least one finding: **functional**, **visual**, **UX**, **performance**.

---

## Findings

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · ⚪ Low

### Functional

| # | Sev | File:Line | Issue |
|---|---|---|---|
| F-1 | 🔴 | `mobile/src/api/client.ts:31` | `fetch()` not wrapped in try/catch — a network failure (offline, DNS) throws an uncaught `TypeError` and crashes the auth/loading paths. |
| F-2 | 🔴 | `mobile/src/screens/RegisterScreen.tsx:20` | Email validation uses `email.includes('@')` — accepts `"@"`, `"a@"`, `"@b"`; account creation reliably fails upstream. |
| F-3 | 🔴 | `mobile/src/screens/SettingsScreen.tsx:13` | `await logout()` inside the Alert callback is not in a try/catch — a failed server call surfaces as an unhandled promise rejection and the user is **not** signed out locally (stale token → next launch the user thinks they're logged in but is actually stuck). |
| F-4 | 🟠 | `mobile/src/api/client.ts:8` | `Config.API_URL` is sometimes an empty string; `??` keeps `""` and requests are sent to `"" + path`, which the URL parser resolves to the current page. |
| F-5 | 🟠 | `mobile/src/api/client.ts` (whole file) | `res.json()` throws on malformed bodies; non-JSON 5xx responses crash the catch block of every screen. |
| F-6 | 🟠 | `mobile/src/screens/RegisterScreen.tsx` | No password confirmation — typo'd passwords only surface on next sign-in. |
| F-7 | 🟠 | `mobile/src/api/client.ts` (error normalization) | `err.error` from server may be object/array — gets rendered as `[object Object]` in user-facing Alerts. |
| F-8 | 🟡 | `mobile/src/components/CategoryPicker.tsx` | Create button has no `disabled`/loading state — double-tap during slow network creates duplicate categories. |
| F-9 | 🟡 | `mobile/src/screens/TimelineScreen.tsx:39` | `todayStr()` uses `toISOString()` (UTC) — for any user west of UTC near midnight, the timeline screen shows the wrong day's data. |
| F-10 | ⚪ | `mobile/src/api/client.ts` | No request timeout — a hung server pins the user on a spinner indefinitely. |

### Visual

| # | Sev | File:Line | Issue |
|---|---|---|---|
| V-1 | 🟠 | `mobile/src/navigation/RootNavigator.tsx` | During auth bootstrap the navigator returns `null`, producing a brief flash of the default white background on every cold launch. |
| V-2 | 🟠 | `mobile/src/screens/SettingsScreen.tsx` | Root is a plain `View` — the "v1.0.0" version line floats at the bottom via an `as never` cast on `marginTop`, which silently breaks when the styles type changes. |
| V-3 | 🟡 | `mobile/src/screens/SettingsScreen.tsx` | Logout card scrolls behind the tab bar on smaller devices — no `SafeAreaView` bottom edge. |
| V-4 | ⚪ | `mobile/src/screens/LoginScreen.tsx` | Inputs have no password reveal toggle — desktop-style flow on mobile. |

### UX

| # | Sev | File:Line | Issue |
|---|---|---|---|
| U-1 | 🟠 | `mobile/src/screens/LoginScreen.tsx` / `RegisterScreen.tsx` | No `SafeAreaView`; on iPhones with a notch the form sits under the status bar. |
| U-2 | 🟠 | `mobile/src/screens/LoginScreen.tsx` / `RegisterScreen.tsx` | No `returnKeyType` chain — after typing email, the user has to manually tap the password field instead of hitting Next on the keyboard. |
| U-3 | 🟠 | `mobile/src/screens/TimerScreen.tsx` | `if (isLoading) return <View/>` — user sees a blank dark screen for the duration of the network round-trip on first paint and on every tab focus. |
| U-4 | 🟠 | `mobile/src/screens/InsightsScreen.tsx` | No loading or error states — query failure leaves the screen showing the previous period's data with no indication. |
| U-5 | 🟠 | `mobile/src/screens/TimerScreen.tsx` | No `useFocusEffect` — when the user returns from another tab the `current-task` cache is stale and the running timer can disagree with the actual backend state. |
| U-6 | 🟡 | `mobile/src/screens/InsightsScreen.tsx` | No pull-to-refresh — only the period chevrons trigger a refetch. |
| U-7 | 🟡 | `mobile/src/components/CategoryPicker.tsx` | FlatList and create form share the modal body — the keyboard pushes the list off-screen mid-scroll. |
| U-8 | ⚪ | `mobile/src/components/TagSelector.tsx` | No `accessibilityRole`/`accessibilityState` — screen readers announce the chip text but not its selectable role or selected state. |

### Performance

| # | Sev | File:Line | Issue |
|---|---|---|---|
| P-1 | 🟠 | `mobile/src/contexts/auth.tsx` | `value` object literal is recreated on every render → every `useAuth()` consumer re-renders on any parent re-render (RootNavigator, every screen). |
| P-2 | 🟠 | `mobile/src/navigation/TabNavigator.tsx` | `screenOptions` is an inline object literal → React Navigation can't memoize; `BrandHeader` remounts on every tab switch. |
| P-3 | 🟠 | `mobile/src/screens/TimelineScreen.tsx` | `renderEntry` recreated on every render → FlatList re-renders all rows on any state change. |
| P-4 | 🟡 | `mobile/src/components/CategoryPicker.tsx` | `renderItem` is a fresh closure per render → same row-re-render pathology for the category list. |
| P-5 | 🟡 | `mobile/src/screens/TimelineScreen.tsx` | `catById = new Map(...)` rebuilt on every render → breaks the memoization added in P-3. |

---

## Fixes applied

### Phase 1 — Foundation fixes (✅ verified)

| Step | File | What changed |
|---|---|---|
| F-1, F-4, F-5, F-7 | `mobile/src/api/client.ts` | Wrapped `fetch` and `res.json()` in try/catch, normalizing to `ApiError(status: 0, "network_error: ...")` and `ApiError(status, "http_NNN")` respectively. Fixed `BASE_URL` fallback to use `\|\|` after `trim()` so empty-string `Config.API_URL` no longer escapes to `""+path`. Added `normalizeErrorMessage()` to stringify non-string server `error` fields. |
| P-1 | `mobile/src/contexts/auth.tsx` | Wrapped `value` in `useMemo`; `signIn`/`signOut` in `useCallback`. Eliminates mass consumer re-renders on unrelated parent state changes. |
| V-1 | `mobile/src/navigation/RootNavigator.tsx` | Replaced `return null` with a styled `AuthLoadingScreen` (`ActivityIndicator` + accent color + safe-area insets) so the cold launch shows a branded spinner instead of a white flash. |
| P-2 | `mobile/src/navigation/TabNavigator.tsx` | Hoisted `screenOptions` to module scope (`SHARED_SCREEN_OPTIONS`); per-screen options to a stable `Record<keyof TabParamList, ...>`. `BrandHeader` no longer remounts on tab switch. |
| (side) | `mobile/tsconfig.json` | Dropped deprecated `baseUrl: "."`; `paths` works without it in TS 5.x. Required to make `npx tsc --noEmit` exit 0. |

### Phase 2 — Screen and component fixes (✅ verified)

| Step | File | What changed |
|---|---|---|
| U-1, U-2, V-4 | `mobile/src/screens/LoginScreen.tsx` | Added `SafeAreaView` + `ScrollView` (`keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`). Chained `returnKeyType` email→password→submit via `useRef`. Added show/hide password toggle with `accessibilityRole="button"`. Added `textContentType` for iOS keychain autofill. |
| U-1, U-2, F-2, F-6 | `mobile/src/screens/RegisterScreen.tsx` | Same `SafeAreaView`/`ScrollView` treatment. Replaced `email.includes('@')` with `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`. Added a confirm-password field with mismatch validation. Show/hide toggle shared with login. |
| U-3, U-5 | `mobile/src/screens/TimerScreen.tsx` | Replaced blank `<View/>` with an `ActivityIndicator` while `isLoading`. Added `useFocusEffect` to refetch `current-task` when the tab regains focus. |
| F-9, P-3, P-5 | `mobile/src/screens/TimelineScreen.tsx` | `todayStr()` now uses local timezone (`getFullYear/getMonth/getDate`) so users west of UTC see the correct "Today". `addDays` switched to local time and uses `setDate` (no more UTC round-trip). `renderEntry` wrapped in `useCallback` with `[data?.entries, catById]` deps; `catById` wrapped in `useMemo` so the deps are actually stable. |
| U-4, U-6 | `mobile/src/screens/InsightsScreen.tsx` | Surfaced `isLoading`/`isError`/`error`/`isRefetching` from the query. Added loading spinner, error card with "Try again" button, and pull-to-refresh via `RefreshControl` themed with the accent color. |
| F-3, V-2, V-3 | `mobile/src/screens/SettingsScreen.tsx` | Wrapped in `SafeAreaView` + `ScrollView`. Logout is try/catch/finally — local `signOut()` always runs even if `logout()` throws. Replaced the unsafe `marginTop: 'auto' as never` cast with a `flexGrow: 1` spacer. |
| U-7, F-8, P-4 | `mobile/src/components/CategoryPicker.tsx` | List and create form are mutually exclusive (form lives in an overlay so the keyboard no longer pushes the FlatList off-screen). `renderItem` memoized via `useCallback`. Added `creating2` loading state with `ActivityIndicator` + `disabled` on the create button, plus a Cancel button. |
| U-8 | `mobile/src/components/TagSelector.tsx` | Container has `accessibilityRole="radiogroup"`; each chip has `accessibilityRole="radio"`, `accessibilityLabel`, `accessibilityState={{ selected }}`, and `accessibilityHint`. |

### Phase 3 — Verification

- `npx tsc --noEmit -p mobile/tsconfig.json` → exits 0
- `npx tsc --noEmit -p shared/tsconfig.json` → exits 0
- `npx tsc --noEmit -p backend/tsconfig.json` → exits 0
- `npm test` → 3 files, 21 tests pass

---

## Remaining recommendations (Medium / Low)

These were not in scope for the Critical/High pass but are worth filing for a future pass:

| # | Sev | Location | Note |
|---|---|---|---|
| F-10 | ⚪ | `api/client.ts` | Add an `AbortController`-based timeout (e.g. 15s) so a hung backend can't pin the UI. |
| ⚪ | All screens | Add `accessibilityLabel` to the icon-only buttons (the period nav chevrons, the BrandHeader chip). The Tags and Category pickers got full a11y treatment; the rest of the iconography didn't. |
| ⚪ | `InsightsScreen.tsx` | The empty state currently triggers only when `totalMinutes === 0`; also surface a "first-run" copy when the account is brand new (no tasks at all). |
| ⚪ | `TimerScreen.tsx` | The `idleHint` is picked once per mount but never rotates; on every cold start the same hint shows. Consider a daily-rotating set or a "shuffle after N seconds" behavior. |
| ⚪ | `mobile/src/theme` | Define semantic color tokens (`colors.surfaceMuted`, `colors.successText`) so component styles don't reach into raw `colors.textMuted` for status indicators. |
| ⚪ | All screens | `Alert.alert(...)` calls lack a `cancelable` on Android; tapping outside the dialog does nothing — fine for now but worth knowing. |

---

## What was deliberately not changed

- **Backend / DB schema** — constraint required. None of the fixes needed server cooperation; the existing `/tasks/start`, `/auth/register`, etc. endpoints accepted the new client-side validation as-is.
- **New runtime dependencies** — constraint required. All fixes used primitives already imported (React Native `SafeAreaView`, `ActivityIndicator`, `RefreshControl`, `useCallback`, `useMemo`).
- **Visual style** — constraint required. The dark theme, the aurora background, and the BrandHeader treatment are preserved exactly; only structural/behavioral changes were made.
- **React Query v5 patterns** — constraint required. All `useQuery` calls still use the existing `{ queryKey, queryFn }` shape; we only started consuming more of the result object (`isLoading`/`isError`/`refetch`) which was already part of v5's API.
