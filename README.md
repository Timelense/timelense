# TimeLens

> Your time tells a story.

TimeLens is a personal time intelligence platform that helps you track activities, analyze productivity patterns, and discover where your time really goes.

---

## Repository Structure

```
timelense/
  shared/    — Shared TypeScript types used by backend and mobile
  backend/   — Fastify + TypeScript REST API with Drizzle ORM + PostgreSQL
  mobile/    — Expo (React Native) mobile app
```

---

## Prerequisites

- [Docker](https://www.docker.com/) + Docker Compose
- [Node.js](https://nodejs.org/) v20+ and npm v10+
- [Expo Go](https://expo.dev/go) on your phone (for physical device testing)

---

## 1. Clone and Install

```bash
git clone <repo-url>
cd timelense
npm install        # installs all workspaces in one step
```

---

## 2. Start the Database

```bash
docker compose up -d db
```

This starts **Postgres 16** on `localhost:5433` (host port 5433 → container 5432).  
Credentials: user `timelense`, password `timelense`, database `timelense`.  
Data is persisted in the `postgres_data` Docker volume.

---

## 3. Configure the Backend

```bash
cp backend/.env.example backend/.env
```

The default values in `.env.example` are correct for the Docker setup:

```
DATABASE_URL=postgresql://timelense:timelense@localhost:5433/timelense
JWT_SECRET=change-me-to-a-long-random-string
PORT=3000
```

Change `JWT_SECRET` to a long random string before running in any shared environment.

---

## 4. Run Migrations and Seed

```bash
npm run db:migrate    # applies Drizzle migrations to the database
npm run db:seed       # creates demo user + 30 days of sample data
```

Demo credentials after seeding: `demo@timelense.app` / `demo1234`

---

## 5. Start the Backend

```bash
npm run dev:backend   # Fastify API in watch mode on http://localhost:3000
```

Verify it's running:

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

---

## 6. Run the Mobile App

```bash
# For a simulator (API on localhost):
npm run dev:mobile

# For a physical device (replace 192.168.x.x with your machine's LAN IP):
EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npm run dev:mobile
```

- Press `i` for iOS Simulator, `a` for Android Emulator
- Scan the QR code with Expo Go on your phone

---

## 7. Run Tests

```bash
npm test   # vitest against a dedicated timelense_test database (auto-created)
```

Tests require the Docker database to be running (`docker compose up -d db`).

---

## Full Stack via Docker

To run both the API and database in Docker (no local Node for the backend):

```bash
docker compose up --build
```

This starts:
- **Postgres 16** on `localhost:5433`
- **Fastify API** on `http://localhost:3000`

Run migrations and seed against the running containers:

```bash
npm run db:migrate
npm run db:seed
```

To stop:

```bash
docker compose down      # keeps data
docker compose down -v   # deletes the database volume too
```

---

## Scripts

| Command               | What it does                              |
|-----------------------|-------------------------------------------|
| `npm run dev:backend` | Start Fastify API in watch mode           |
| `npm run dev:mobile`  | Start Expo dev server                     |
| `npm run db:migrate`  | Apply database migrations                 |
| `npm run db:seed`     | Seed demo user + 30 days of sample data   |
| `npm test`            | Run backend test suite                    |
| `npm run build`       | Build shared types + backend              |
| `npm run typecheck`   | Type-check shared + backend               |

---

## Tech Stack

| Layer    | Technology                              |
|----------|-----------------------------------------|
| Mobile   | React Native · Expo SDK 56              |
| Backend  | Node.js · Fastify 4 · TypeScript        |
| Database | PostgreSQL 16 · Drizzle ORM             |
| Auth     | JWT (`@fastify/jwt`) · bcryptjs         |
| Types    | Shared TypeScript workspace package     |
