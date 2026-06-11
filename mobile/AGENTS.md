# Mobile — bare React Native CLI

This app uses **React Native CLI** (not Expo). RN 0.85.3 / React 19.2.3.

- Navigation: React Navigation (`@react-navigation/native` + native-stack + bottom-tabs). Routing lives in `src/navigation/`; screens in `src/screens/`.
- Secure storage: `react-native-keychain` (see `src/api/client.ts`).
- Config/env: `react-native-config` reads `.env` (`API_URL`).
- Entry: `index.js` → `App.tsx`.
- Monorepo: `@timelense/shared` resolves via the workspace; Metro is configured for the monorepo in `metro.config.js`.

## Running

```sh
npm install               # from repo root (workspaces)
cd ios && bundle exec pod install && cd ..   # iOS native deps
npm run ios --workspace=mobile      # or: npm run android --workspace=mobile
```

Native projects live in `ios/` and `android/`. After changing native deps, re-run `pod install`.
