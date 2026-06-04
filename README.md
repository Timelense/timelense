# TimeLens

> Your time tells a story.

TimeLens is a personal time intelligence platform that helps users track activities, analyze productivity patterns, and discover where their time really goes. More than a time tracker, TimeLens turns daily actions into meaningful insights — because every hour tells a story.

---

## Repository Structure

```
timelense/
  shared/    — Shared TypeScript types (DTOs, enums) used by backend and mobile
  backend/   — Fastify + TypeScript REST API with Drizzle ORM + PostgreSQL
  mobile/    — Expo (React Native) mobile app
```

---

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose (for the backend + database)
- [Node.js](https://nodejs.org/) v20+ and [npm](https://www.npmjs.com/) v10+ (for mobile development)
- [Expo Go](https://expo.dev/go) app on your phone (for mobile development)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd timelense
npm install        # installs all workspaces (shared, backend, mobile) in one step
```

---

## 2. Backend + Database (Docker)

The easiest way to run the backend and Postgres together:

```bash
docker compose up --build
```

This starts:
- **Postgres 16** on `localhost:5432` (credentials: `timelense / timelense / timelense`)
- **Fastify API** on `http://localhost:3000`

Postgres data is persisted in a Docker volume (`postgres_data`) so it survives restarts.

Verify the API is running:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

To stop:

```bash
docker compose down          # stops containers, keeps data
docker compose down -v       # stops containers and deletes the database volume
```

### Running migrations

Migrations need to run against the live database. With Docker running:

```bash
cd backend
DATABASE_URL=postgresql://timelense:timelense@localhost:5432/timelense npx drizzle-kit migrate
cd ..
```

### Local development (without Docker)

If you prefer to run the backend directly with a local Postgres:

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your DATABASE_URL and JWT_SECRET
npm run dev:backend
```

---

## 3. Mobile Setup

```bash
npm run dev:mobile         # starts the Expo dev server
```

- Press `i` to open in iOS Simulator
- Press `a` to open in Android Emulator
- Scan the QR code with Expo Go on your phone

---

## 4. Shared Types

The `shared/` package contains TypeScript types used by both `backend` and `mobile`. It is a local workspace package — no publishing required. Build it if you need the compiled output:

```bash
npm run build --workspace=shared
```

---

## Tech Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Mobile   | React Native · Expo                 |
| Backend  | Node.js · Fastify · TypeScript      |
| Database | PostgreSQL · Drizzle ORM            |
| Auth     | JWT (`@fastify/jwt`)                |
| Types    | Shared TypeScript workspace package |

---

## Scripts (from repo root)

| Command              | What it does                            |
|----------------------|-----------------------------------------|
| `npm run dev:backend`  | Start Fastify API in watch mode         |
| `npm run dev:mobile`   | Start Expo dev server                   |
| `npm run build`        | Build shared types + backend            |
| `npm run typecheck`    | Type-check shared + backend             |
