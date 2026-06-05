# Graceful Shutdown

## Overview

When the process receives **SIGTERM** or **SIGINT**, the server stops accepting new connections, drains any in-flight HTTP requests, and then closes all resources in a controlled order.  If the drain takes longer than the configured timeout, the process force-exits to avoid hanging indefinitely.

## Shutdown sequence

```
Signal received (SIGTERM / SIGINT)
         │
         ▼
Stop accepting new HTTP connections
         │
         ▼
Drain in-flight requests (app.close)
         │
         ▼  ── onClose hooks fire in LIFO registration order ──
         │
  1. Swagger UI plugin
  2. Socket.IO server    ← io.close() disconnects all WebSocket clients
  3. Redis connections   ← redis.quit() + redisSub.quit()
  4. Cleanup job         ← clearInterval (token cleanup timer)
  5. PostgreSQL pool     ← pool.end()
         │
         ▼
      process.exit(0)
```

If any step throws, or if the whole sequence exceeds `timeoutMs`, `process.exit(1)` is called instead.

## Configuration

`registerShutdown` accepts an optional options object:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeoutMs` | `number` | `10_000` | Milliseconds before a force-exit is triggered |

## Usage

```typescript
// src/app.ts — called once after the server starts listening
import { registerShutdown } from './shared/shutdown';

await app.listen({ port: env.PORT, host: env.HOST });
registerShutdown(app);                       // registers SIGTERM + SIGINT handlers
registerShutdown(app, { timeoutMs: 5_000 }); // custom 5 s timeout
```

## Logs emitted

| Level | Message |
|-------|---------|
| `info` | `Graceful shutdown handlers registered (SIGTERM, SIGINT)` |
| `info` | `Signal received, starting graceful shutdown` (with `signal` field) |
| `info` | `Waiting for in-flight requests to complete` |
| `info` | `Graceful shutdown complete` |
| `warn` | `Shutdown already in progress, ignoring signal` |
| `error` | `Error during graceful shutdown` (with `err` field) |
| `fatal` | `Graceful shutdown timed out, forcing exit` (with `timeoutMs` field) |

Individual plugins also log their own closing steps:
- `PostgreSQL pool closed`
- `Redis connections closed`

## Testing

`createGracefulShutdown` is exported separately so tests can call the shutdown function directly without emitting real OS signals:

```typescript
import { createGracefulShutdown } from '../src/shared/shutdown';

const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
const shutdown = createGracefulShutdown(app);

await shutdown('SIGTERM');
expect(exitSpy).toHaveBeenCalledWith(0);
```

Run the shutdown test suite:

```bash
npx vitest run tests/shutdown.test.ts
```
