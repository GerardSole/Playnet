# Playnet

> A production-grade game backend inspired by [Nakama](https://heroiclabs.com/nakama/), built from scratch with Node.js, TypeScript, and Fastify — covering real-time WebSockets, JWT auth, matchmaking, leaderboards, and horizontal scalability.

[![CI](https://github.com/GerardSole/Playnet/actions/workflows/ci.yml/badge.svg)](https://github.com/GerardSole/Playnet/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node.js-22-green?logo=node.js)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## Overview

Playnet is a monolithic game backend built as a portfolio project to demonstrate backend engineering fundamentals in a non-trivial, real-world context.

**What this project demonstrates:**
- REST API design (versioned, OpenAPI-documented, consistently structured)
- Stateless JWT authentication with refresh token rotation and session limits
- Real-time event delivery via WebSockets with cross-instance fan-out
- Race-condition-safe matchmaking using atomic Redis operations
- Horizontal scalability with nginx + Redis Adapter (no sticky state in the app layer)
- Integration testing against real infrastructure (PostgreSQL + Redis)

**Key patterns used:**

| Concern | Approach |
|---|---|
| REST API | Fastify v5 + Zod validation + OpenAPI/Swagger |
| Authentication | JWT access tokens + refresh token rotation, LRU session eviction |
| Real-time | Socket.IO + Redis Adapter (horizontal fan-out, no sticky sessions) |
| Matchmaking | Redis sorted set + **atomic Lua scripts** (race-condition safe) |
| Leaderboards | PostgreSQL window functions (`RANK() OVER`) |
| Presence | Redis pub/sub + store interface (swappable backend) |
| Rate limiting | Redis-backed distributed counters (stricter limits for auth routes) |
| DB cleanup | PostgreSQL advisory locks to coordinate across instances |
| Containerisation | Docker multi-stage build + Docker Compose |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   API (Fastify)                  │
│                                                  │
│  Auth  Users  Friends  Presence  Matchmaking     │
│  Leaderboards  Notifications                     │
│                                                  │
│  Controller → Service → Repository               │
└───────────────┬─────────────────┬───────────────┘
                │                 │
         ┌──────▼──────┐   ┌─────▼─────┐
         │  PostgreSQL  │   │   Redis   │
         │  (persist)  │   │  (queue,  │
         │             │   │  sessions,│
         └─────────────┘   │  pub/sub) │
                           └───────────┘
```

Multi-instance deployment routes traffic through Nginx and uses:
- **Redis Adapter** for Socket.IO cross-instance event fanout
- **PostgreSQL advisory locks** for distributed cleanup coordination
- **Atomic Lua scripts** for race-free matchmaking

---

## Design Decisions

A few non-obvious choices made during development:

**Matchmaking with atomic Lua scripts**  
Two players joining the queue at the same millisecond could both read an empty queue and both create a "match" with only themselves. Instead of an application-level lock, the match creation logic runs as a single Lua script inside Redis — atomic by design. No distributed lock needed.

**Presence via a store interface**  
Presence state is hidden behind a `PresenceStore` interface. The production implementation uses Redis pub/sub; tests inject a simple in-memory store. This avoids test infrastructure setup for every test that touches presence, while keeping the production path identical.

**PostgreSQL advisory locks for token cleanup**  
A background job deletes expired refresh tokens on an interval. In a multi-instance setup, all nodes run the job simultaneously. Rather than add a separate scheduler service, the job acquires a PostgreSQL advisory lock at startup — only one node runs cleanup at a time, with zero extra infrastructure.

**Modular monolith over microservices**  
Each domain module is isolated (no cross-module DB access, communication only through service interfaces), which means it can be extracted into a microservice later. But during the build phase, everything deploys as one binary — simpler to test, debug, and operate.

---

## Tech Stack

- **Runtime**: Node.js 22 (LTS)
- **Framework**: Fastify 5
- **Language**: TypeScript 5 (strict mode)
- **Database**: PostgreSQL 16
- **Cache/Queue**: Redis 7 + ioredis
- **WebSocket**: Socket.IO 4 + `@socket.io/redis-adapter`
- **Validation**: Zod 4 (input) + AJV (response serialization + OpenAPI)
- **Testing**: Vitest 4 (integration tests)
- **Containerisation**: Docker + Docker Compose

---

## Prerequisites

- Node.js ≥ 22
- Docker + Docker Compose
- PostgreSQL 16 (or use Docker)
- Redis 7 (or use Docker)

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/GerardSole/Playnet.git
cd playnet
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set JWT_SECRET (minimum 32 characters)
```

### 3. Start infrastructure

```bash
docker-compose up -d postgres redis
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Start the API

```bash
npm run dev          # development (hot reload)
npm start            # production
```

API is available at `http://localhost:3000`
Swagger UI at `http://localhost:3000/docs`

---

## Docker Compose

### Single instance (development)

```bash
docker-compose up
```

### Multi-instance with Nginx load balancer

```bash
docker-compose -f docker-compose.yml -f docker-compose.scale.yml up --scale api=3
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✓ | — | PostgreSQL connection string |
| `REDIS_URL` | ✓ | — | Redis connection string |
| `JWT_SECRET` | ✓ | — | HMAC-SHA256 secret (≥ 32 chars) |
| `JWT_EXPIRES_IN` | | `15m` | Access token TTL |
| `REFRESH_TOKEN_EXPIRES_IN` | | `7d` | Refresh token TTL |
| `PORT` | | `3000` | HTTP port |
| `MAX_SESSIONS_PER_USER` | | `5` | Concurrent sessions per user |
| `TOKEN_CLEANUP_INTERVAL_MS` | | `3600000` | Expired token cleanup interval |
| `TOKEN_CLEANUP_BATCH_SIZE` | | `1000` | Rows deleted per cleanup run |
| `RATE_LIMIT_MAX` | | `100` | Requests per window (global) |
| `RATE_LIMIT_WINDOW_MS` | | `60000` | Rate limit window in ms |
| `AUTH_RATE_LIMIT_MAX` | | `10` | Requests per window (auth routes) |

---

## API Reference

Full interactive documentation is available at `/docs` (Swagger UI).

### Authentication

```
POST /api/v1/auth/register    Register a new account
POST /api/v1/auth/login       Login (returns access + refresh token)
POST /api/v1/auth/refresh     Rotate refresh token
POST /api/v1/auth/logout      Revoke refresh token
```

All protected endpoints require:
```
Authorization: Bearer <accessToken>
```

### Endpoints

| Module | Endpoints |
|---|---|
| Users | `GET /me`, `GET /:id`, `POST /` |
| Friends | `POST /request`, `POST /accept`, `POST /reject`, `GET /`, `DELETE /:id` |
| Presence | `PUT /`, `GET /`, `GET /:userId` |
| Matchmaking | `POST /join`, `POST /leave`, `GET /status` |
| Leaderboards | `POST /`, `POST /:id/submit`, `GET /:id`, `GET /:id/player/:pid` |
| Notifications | `GET /`, `POST /read` |

### WebSocket

Connect with Socket.IO:
```javascript
const socket = io('ws://localhost:3000', {
  auth: { token: '<accessToken>' }
});

socket.on('match:created',    ({ matchId, players }) => { /* ... */ });
socket.on('notification:new', ({ id, type, payload }) => { /* ... */ });
```

---

## Testing

```bash
npm test                # run all tests
npm run test:coverage   # run with coverage report
npm run test:ci         # run with coverage + verbose (used in CI)
npm run test:watch      # watch mode for development
```

### Test suite

| File | Tests | Description |
|---|---|---|
| `auth.test.ts` | 13 | Register, login, refresh, logout |
| `auth-session-limit.test.ts` | 12 | LRU session eviction |
| `users.test.ts` | 9 | Profile endpoints |
| `friends.test.ts` | 12 | Friend request lifecycle |
| `leaderboards.test.ts` | 18 | Score submission, rankings |
| `matchmaking.test.ts` | 11 | Queue join/leave/status |
| `matchmaking-concurrency.test.ts` | 8 | Concurrent join race conditions |
| `rate-limit-distributed.test.ts` | 11 | Distributed rate limiting |
| `token-cleanup.test.ts` | 13 | Advisory-lock cleanup job |
| **Total** | **107** | |

---

## CI/CD Pipeline

The GitHub Actions workflow in `.github/workflows/ci.yml` runs on every push and PR:

```
quality (lint + typecheck, ~1 min)
     ├──► test  (integration tests + coverage, ~4 min)
     └──► build (TypeScript compile, ~30 s)
                │
                └──► docker (image build, ~3 min)
```

Each stage fails fast. A `quality` failure immediately blocks the expensive test and build stages. Docker only runs when tests pass and build compiles.

Coverage reports are uploaded as workflow artifacts and posted as PR comments.

---

## Project Structure

```
src/
├── modules/
│   ├── auth/          # JWT authentication + session management
│   ├── friends/       # Friend requests + bidirectional friendship
│   ├── leaderboards/  # Score submission + rankings
│   ├── matchmaking/   # Redis queue + Lua atomic match creation
│   ├── notifications/ # In-app notification feed
│   ├── presence/      # Online/offline status (Redis)
│   └── users/         # User profiles
├── realtime/
│   └── gateway.plugin.ts   # Socket.IO + Redis Adapter
└── shared/
    ├── errors/         # AppError hierarchy
    ├── middleware/     # Auth guard
    ├── plugins/        # Fastify plugins (db, redis, rate-limit, cleanup)
    └── utils/          # zodToFastify helper

database/
└── migrations/         # Sequential SQL migrations (001-009)

tests/                  # Integration tests
.github/
└── workflows/
    └── ci.yml          # GitHub Actions CI pipeline
```
