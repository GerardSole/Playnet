import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app';
import { createGracefulShutdown, registerShutdown } from '../src/shared/shutdown';

// One real app instance shared across all tests.
// app.close() is mocked per-test so resources stay open between tests;
// the real close happens in afterAll.
let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as () => never);
});

afterEach(() => {
  vi.restoreAllMocks();
  // Remove any signal listeners added during the test
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
});

// ── createGracefulShutdown ────────────────────────────────────────────────────

describe('createGracefulShutdown', () => {
  it('calls app.close() then exits with code 0 on success', async () => {
    const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined);

    const shutdown = createGracefulShutdown(app);
    await shutdown('SIGTERM');

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('exits with code 1 when app.close() throws', async () => {
    vi.spyOn(app, 'close').mockRejectedValueOnce(new Error('close failed'));

    const shutdown = createGracefulShutdown(app);
    await shutdown('SIGTERM');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('is idempotent — a second call while shutting down is a no-op', async () => {
    const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined);

    const shutdown = createGracefulShutdown(app);
    await shutdown('SIGTERM');
    await shutdown('SIGTERM'); // second call must be ignored

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledOnce();
  });

  it('accepts any signal label in the log (SIGINT, etc.)', async () => {
    vi.spyOn(app, 'close').mockResolvedValue(undefined);

    const shutdown = createGracefulShutdown(app);
    await shutdown('SIGINT');

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('force-exits with code 1 after timeoutMs when app.close() never resolves', async () => {
    // Use a real 20 ms timeout so we avoid fake-timer state leaking into
    // subsequent tests (Vitest 4 converts pending fake timers to real timers
    // when vi.useRealTimers() is called, which can fire during later tests).
    vi.spyOn(app, 'close').mockImplementation(() => new Promise(() => {}));

    const shutdown = createGracefulShutdown(app, { timeoutMs: 20 });
    void shutdown('SIGTERM');

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('does not force-exit before timeoutMs elapses', async () => {
    // close resolves after 10 ms; timeout is 200 ms — exit(0) wins.
    vi.spyOn(app, 'close').mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 10))
    );

    const shutdown = createGracefulShutdown(app, { timeoutMs: 200 });
    await shutdown('SIGTERM');

    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(exitSpy).not.toHaveBeenCalledWith(1);
  });
});

// ── registerShutdown ──────────────────────────────────────────────────────────

describe('registerShutdown', () => {
  it('adds exactly one SIGTERM listener', () => {
    const before = process.listenerCount('SIGTERM');
    registerShutdown(app);
    expect(process.listenerCount('SIGTERM')).toBe(before + 1);
  });

  it('adds exactly one SIGINT listener', () => {
    const before = process.listenerCount('SIGINT');
    registerShutdown(app);
    expect(process.listenerCount('SIGINT')).toBe(before + 1);
  });

  it('the registered SIGTERM handler calls app.close() and exits 0', async () => {
    const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined);
    registerShutdown(app);

    // Call the listener directly instead of process.emit — avoids firing other
    // handlers registered by the module-level start() in src/app.ts.
    const handlers = process.rawListeners('SIGTERM') as Array<() => void>;
    const ourHandler = handlers[handlers.length - 1];

    await new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
      ourHandler();
    });

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('the registered SIGINT handler calls app.close() and exits 0', async () => {
    const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined);
    registerShutdown(app);

    const handlers = process.rawListeners('SIGINT') as Array<() => void>;
    const ourHandler = handlers[handlers.length - 1];

    await new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
      ourHandler();
    });

    expect(closeSpy).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('uses process.once — listener is removed after it fires', async () => {
    const closeSpy = vi.spyOn(app, 'close').mockResolvedValue(undefined);
    registerShutdown(app);
    const afterRegister = process.listenerCount('SIGTERM');

    const handlers = process.rawListeners('SIGTERM') as Array<() => void>;
    const ourHandler = handlers[handlers.length - 1];

    await new Promise<void>((resolve) => {
      exitSpy.mockImplementation((() => resolve()) as () => never);
      ourHandler(); // once-wrapper removes itself from the emitter when called
    });

    expect(closeSpy).toHaveBeenCalledOnce();
    // Listener count must drop by 1 because process.once cleans up after itself
    expect(process.listenerCount('SIGTERM')).toBe(afterRegister - 1);
  });
});
