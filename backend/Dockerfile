FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --workspace=shared --workspace=backend

# Copy source
COPY tsconfig.base.json ./
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared types then backend
RUN npm run build --workspace=shared
RUN npm run build --workspace=backend

# --- production image ---
FROM node:20-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --workspace=shared --workspace=backend --omit=dev

COPY --from=base /app/shared/dist ./shared/dist
COPY --from=base /app/backend/dist ./backend/dist

WORKDIR /app/backend
EXPOSE 3000

CMD ["node", "dist/backend/src/server.js"]
