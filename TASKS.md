# TimeLens — Implementation Tasks

This is the execution plan for the TimeLens MVP (see `plan.md` for the product vision).
Work through tasks **in order, one at a time**. Each task lists its goal, the files to
touch, detailed requirements, and acceptance criteria. Do not start a task until the
previous one's acceptance criteria pass.

## How to work (read first)

- **Stack (already in place — do not swap libraries):** Fastify 4 + `@fastify/jwt` + Drizzle ORM + Postgres 16 + Zod on the backend; Expo SDK 56 / React Native 0.85 on mobile; shared TypeScript types in `shared/src/types`.
- **Monorepo layout:** `backend/`, `mobile/`, `shared/` (npm workspaces from the root `package.json`).
- **Database:** run `docker compose up -d db` for local Postgres (`postgresql://timelense:timelense@localhost:5432/timelense`). Copy `backend/.env.example` to `backend/.env` and set `DATABASE_URL` to that value.
- **Verification loop for every backend task:** `npm run typecheck` in `backend/`, start the API with `npm run dev`, then exercise the new endpoints with `curl` and confirm both the success path and at least one failure path (bad input, missing auth, wrong owner).
- **Verification loop for every mobile task:** `npx tsc --noEmit` in `mobile/`, then `npm run start` and check the screen in Expo Go or a simulator.
- **Mobile caveat:** Expo has changed significantly. Per `mobile/AGENTS.md`, consult the versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing Expo code — do not rely on memory of older SDKs.
- **Shared types are the contract.** Whenever an API request/response shape is created or changed, define/update the type in `shared/src/types/index.ts` and import it on both sides. Never duplicate a shape inline.
- **Commit after each completed task** with a message like `feat(backend): task 2.1 — register/login endpoints`.
- **Don't gold-plate.** No rate limiting, no email verification, no refresh tokens, no offline sync in the MVP. If something feels missing, note it at the bottom of this file under "Deferred" instead of building it.

---

## Phase 1 — Database & migrations

### Task 1.1 — Finish the schema and generate migrations

**Goal:** A complete, migrated schema that supports every MVP feature.

**Files:** `backend/src/db/schema.ts`, `backend/drizzle.config.ts`, generated files under `backend/drizzle/`.

**Requirements:**
1. Extend the existing `tasks` table: constrain `tag` to the three values of `ProductivityTag` (`'productive' | 'non-productive' | 'neutral'`) using a Postgres enum or a check constraint.
2. Add a self-reference for `categories.parentId` → `categories.id` with `onDelete: 'set null'` (sub-categories are one level deep in the UI, but the schema doesn't need to enforce depth).
3. Add a `color` column to `categories` (varchar(7), hex like `#A3C9F1`, nullable) for charts.
4. Add indexes that the analytics queries will need: `tasks(user_id, started_at)` and `tasks(user_id, category_id)`.
5. Add a partial unique index enforcing **at most one running task per user**: unique on `tasks(user_id)` where `ended_at IS NULL`.
6. Add an npm script `db:generate` (drizzle-kit generate) and `db:migrate` (drizzle-kit migrate) to `backend/package.json`; generate and apply the migration.

**Acceptance criteria:**
- `npm run db:migrate` succeeds against the dockerized Postgres from a clean volume.
- Inserting a second row with `ended_at IS NULL` for the same user fails at the DB level.
- `npm run typecheck` passes.

### Task 1.2 — Seed script

**Goal:** Realistic local data so analytics screens are testable from day one.

**Files:** `backend/src/db/seed.ts`, npm script `db:seed`.

**Requirements:**
1. Create one demo user (`demo@timelense.app` / password `demo1234`, hashed the same way auth will hash — see Task 2.1; share the hash helper).
2. Create ~6 categories (e.g. Work, Deep Work ⊂ Work, Meetings ⊂ Work, Exercise, Social Media, Chores) with colors.
3. Create ~80 task entries spread over the past 30 days with plausible durations (15 min – 3 h), mixed tags, some with notes. No entry may overlap midnight in a way that breaks daily grouping — keep each entry within a single day.
4. Script must be idempotent: re-running wipes and re-creates only the demo user's data.

**Acceptance criteria:** `npm run db:seed` runs twice without error; `select count(*) from tasks` shows the expected rows.

---

## Phase 2 — Auth

### Task 2.1 — Register & login

**Goal:** Working JWT auth replacing the 501 stubs in `backend/src/routes/auth.ts`.

**Files:** `backend/src/routes/auth.ts`, `backend/src/lib/password.ts` (new), `shared/src/types/index.ts`.

**Requirements:**
1. `POST /auth/register` — Zod-validate `{ email, password }` (valid email; password ≥ 8 chars). Hash with `bcryptjs` (add the dependency). Insert user; on duplicate email return `409 { error: 'email_taken' }`. Respond `201 { token, user: { id, email } }` where `token` is signed via `app.jwt.sign({ sub: user.id })` with 30-day expiry.
2. `POST /auth/login` — validate credentials; wrong email or password both return `401 { error: 'invalid_credentials' }` (same message — don't leak which was wrong). Success returns the same shape as register.
3. Add an `authenticate` decorator/plugin (`backend/src/plugins/auth.ts`): a `preHandler` that calls `request.jwtVerify()` and returns `401 { error: 'unauthorized' }` on failure, exposing `request.userId` (typed via module augmentation).
4. Add `AuthResponse` to shared types.
5. Validation errors return `400 { error: 'validation_error', details: [...] }` — implement this once as a global Fastify error handler for ZodError so all later routes inherit it.

**Acceptance criteria (curl):**
- register → 201 with token; duplicate register → 409.
- login with wrong password → 401; right password → 200 + token.
- A protected dummy route rejects missing/garbage tokens with 401.

---

## Phase 3 — Core API

> All routes in this phase require auth and must scope every query by `request.userId`.
> Accessing another user's resource returns `404` (not 403 — don't reveal existence).

### Task 3.1 — Categories CRUD

**Files:** `backend/src/routes/categories.ts` (new, registered with prefix `/categories`), shared types.

**Requirements:**
1. `GET /categories` — flat list of the user's categories `{ id, name, parentId, color }`.
2. `POST /categories` — `{ name, parentId?, color? }`. Reject (400) a `parentId` that doesn't exist, belongs to another user, or itself has a parent (max depth 2).
3. `PATCH /categories/:id` — same fields, same parent rules.
4. `DELETE /categories/:id` — deleting a parent re-parents its children to null; tasks keep `category_id = null` via the existing FK.
5. Update shared `Category` type to include `color`.

**Acceptance criteria:** CRUD round-trip via curl; depth-3 nesting rejected; cross-user access returns 404.

### Task 3.2 — Timer & task entries

**Files:** `backend/src/routes/tasks.ts`, shared types.

**Requirements:**
1. `POST /tasks/start` — `{ title, categoryId?, tag?, notes? }` (tag defaults to `neutral`). **If a task is already running, stop it first** (set its `endedAt = now()`), then create the new one. Return `201 { task, stoppedTask? }`.
2. `PATCH /tasks/:id/stop` — sets `endedAt = now()`. Stopping an already-stopped task → `409 { error: 'not_running' }`.
3. `GET /tasks/current` — the running task or `null`.
4. `GET /tasks?from=ISO&to=ISO&categoryId=&tag=&limit=&offset=` — entries overlapping the range, newest first, default limit 50.
5. `PATCH /tasks/:id` — edit `title, categoryId, tag, notes, startedAt, endedAt` (for manual corrections). Validate `endedAt > startedAt` and duration ≤ 24 h.
6. `DELETE /tasks/:id`.
7. Validate `categoryId` ownership on create/update.

**Acceptance criteria:** start → start again auto-stops the first; `current` reflects state; list filters work; editing with `endedAt < startedAt` → 400.

### Task 3.3 — Analytics endpoints

**Goal:** All aggregation happens in SQL/Drizzle on the server — the mobile app must never compute analytics from raw entries.

**Files:** `backend/src/routes/analytics.ts` (new, prefix `/analytics`), `backend/src/lib/analytics.ts` for the query helpers, shared types.

**Definitions (use exactly these):**
- An entry's **minutes within a range** = overlap between `[startedAt, endedAt ?? now()]` and the query range, in whole minutes.
- **Productivity score** for a range = `round(100 * productiveMinutes / (productiveMinutes + nonProductiveMinutes))`; if the denominator is 0 the score is `null`. Neutral time never affects the score.

**Requirements:**
1. `GET /analytics/timeline?date=YYYY-MM-DD` — that day's entries ordered by `startedAt`, each with computed `durationMinutes`, plus the day's totals per tag and the day's score. Shared type `DailyTimeline`.
2. `GET /analytics/distribution?from&to&groupBy=category|tag` — total minutes per group over the range. For `category`, group by **top-level** category (roll sub-categories into their parent; uncategorized → `null` bucket) and include `name` and `color`. Shared type `Distribution`.
3. `GET /analytics/insights?period=week|month&offset=0` — for the period (offset 0 = current, 1 = previous…): per-day total/productive/non-productive minutes and score, the period totals + score, the top 3 categories by minutes, and a comparison vs the previous period (`deltaTotalMinutes`, `deltaScore`). Shared type `PeriodInsights`. Weeks start Monday.
4. `GET /analytics/report?from&to` — implements the existing shared `TimeReport` type (extend it with a `score` field).
5. All date params validated with Zod; invalid → 400. Ranges capped at 366 days.

**Acceptance criteria:** With seeded data, each endpoint returns plausible, internally consistent numbers (per-day rows sum to period totals; score matches the formula by hand-check on one day). Empty ranges return zeroed structures, not errors.

---

## Phase 4 — Mobile foundation

### Task 4.1 — Navigation, theming, API client

**Files:** under `mobile/` — `src/api/client.ts`, `src/api/` per-resource modules, `src/theme.ts`, navigation setup, `App.tsx`.

**Requirements:**
1. Add `expo-router` (file-based routing, Expo 56 compatible) **or** `@react-navigation/native` + native-stack + bottom-tabs — check the Expo 56 docs and pick the one that installs cleanly; don't fight versions.
2. Tab layout: **Timer** (home), **Timeline**, **Insights**, **Settings**. Auth screens (Login/Register) live outside the tabs and gate them.
3. `src/api/client.ts`: small typed `fetch` wrapper — base URL from `process.env.EXPO_PUBLIC_API_URL` (default `http://localhost:3000`), JSON in/out, attaches `Authorization: Bearer <token>`, throws a typed `ApiError { status, error }`. On 401, clear the stored token and route to Login.
4. Token storage with `expo-secure-store`.
5. Light theme only: define colors/spacing/typography tokens in `src/theme.ts` and use them everywhere — no hardcoded hex in components.
6. Server state via `@tanstack/react-query` (QueryClientProvider at the root). Auth state via a small context.

**Acceptance criteria:** App boots to Login when no token; after login (against the running backend) lands on Timer tab; kill/relaunch keeps the session; `npx tsc --noEmit` passes.

### Task 4.2 — Auth screens

**Files:** login & register screens, `src/api/auth.ts`.

**Requirements:** Email + password forms with inline validation mirroring the server rules; loading state on submit; server errors (409, 401) surfaced as friendly messages; link to switch between login/register; logout button on Settings tab.

**Acceptance criteria:** Full register → logout → login round-trip against the local API.

---

## Phase 5 — Mobile core features

### Task 5.1 — Timer screen

**Files:** Timer tab screen + components, `src/api/tasks.ts`, `src/api/categories.ts`.

**Requirements:**
1. **Idle state:** title input, category picker (grouped parent → children, with colors), tag selector (3 segmented options, default Neutral), optional notes, big Start button.
2. **Running state:** task title, category, live elapsed time (ticking every second, computed from `startedAt` — not from an accumulating counter, so it survives backgrounding), Stop button, and an "edit notes" affordance.
3. On app start, query `GET /tasks/current` to restore a running timer.
4. Starting while another task runs shows the auto-stop behavior returned by the API (toast/snackbar: "Stopped ‘X’").
5. Category creation inline from the picker ("+ New category" → name, optional parent, color from a fixed palette).

**Acceptance criteria:** Start → background the app → reopen shows correct elapsed time; stop writes the entry; new categories appear immediately (react-query invalidation).

### Task 5.2 — Timeline screen

**Files:** Timeline tab screen + components.

**Requirements:**
1. Date header with prev/next-day arrows and a "Today" reset; data from `GET /analytics/timeline`.
2. Vertical list of the day's entries: time range, title, category dot+name, tag badge, duration. Tapping opens an edit sheet (PATCH: title, category, tag, notes, start/end times) with delete.
3. Summary card at top: total tracked, productive/non-productive/neutral split, score for the day.
4. Empty state with a friendly prompt to start the timer.

**Acceptance criteria:** Edits and deletes reflect immediately and update the summary card; navigating days fetches the right data.

### Task 5.3 — Insights screen

**Files:** Insights tab screen + chart components.

**Requirements:**
1. Week/Month toggle + period navigation (offset), data from `/analytics/insights` and `/analytics/distribution`.
2. Score card: big number + delta vs previous period (▲/▼ with color).
3. Bar chart of minutes per day (stacked productive/non-productive/neutral). Use `react-native-svg` and draw simple bars directly — do not add a heavyweight chart library.
4. Donut or horizontal-bar breakdown of time per top-level category using category colors.
5. Top-3 categories list with minutes and share %.

**Acceptance criteria:** Numbers visibly match a curl of the same endpoints; period navigation works; renders sanely with empty data.

---

## Phase 6 — Hardening & polish

### Task 6.1 — Backend tests

**Files:** `backend/src/**/*.test.ts`, vitest config, npm script `test`.

**Requirements:** Add `vitest`. Cover: auth (register/login/dup/401), the one-running-task invariant, the score formula and overlap-with-range minute computation (pure-function unit tests for `lib/analytics.ts`), and ownership scoping (user A cannot read/modify user B's task — expect 404). Use Fastify's `app.inject()`; tests run against a dedicated `timelense_test` database (create/migrate in a global setup, truncate between tests).

**Acceptance criteria:** `npm test` green and repeatable.

### Task 6.2 — Final pass

**Requirements:**
1. `README.md`: rewrite with real setup instructions (docker compose, env, migrate, seed, run backend, run mobile with `EXPO_PUBLIC_API_URL` pointing at the machine's LAN IP for device testing).
2. Root npm scripts: `dev:backend`, `dev:mobile`, `db:migrate`, `db:seed`, `test`.
3. Sweep both apps for: leftover `console.log`s, hardcoded URLs/colors, unused deps, missing loading/error states on every query-backed screen.
4. Verify the dockerized API (`docker compose up`) passes the same curl checks as Task 3.x.

**Acceptance criteria:** A fresh clone can reach a working app following only the README.

---

## Deferred (post-MVP — do not build now)

- OAuth providers (Google/Apple) — JWT email/password only for MVP.
- Refresh tokens / token rotation.
- Offline tracking & sync.
- Push notifications / reminders.
- Dark mode.
- AI coach, automatic activity detection, calendar integration (see `plan.md` roadmap).
