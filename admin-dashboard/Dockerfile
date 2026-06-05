# ── Stage 1: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL vacío → el navegador usará rutas relativas (/api/...)
# nginx se encarga de hacer el proxy al contenedor api:3000
# Se usa npx vite build directamente para evitar el paso tsc -b
# (el type-check ya se hace en local y en CI, no en Docker)
RUN VITE_API_URL="" npx vite build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
