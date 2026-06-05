# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: builder — install all deps and compile TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: runner — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

# Run as non-root user
RUN addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production

# Production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Compiled application from builder
COPY --from=builder /app/dist ./dist

# Migration SQL files (read at runtime by dist/migrate.js)
COPY database/ ./database/

# Startup script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER app

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
