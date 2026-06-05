import type { FastifyInstance } from 'fastify';

export interface ShutdownOptions {
  /** Max milliseconds to wait for in-flight requests before forcing exit. Default: 10_000 */
  timeoutMs?: number;
}

/**
 * Creates the async shutdown handler.
 *
 * Exported for unit testing — call the returned function directly instead of
 * emitting process signals.  app.close() runs onClose hooks in LIFO order:
 *   swagger → gateway (Socket.IO) → redis → cleanup → database (PostgreSQL)
 */
export function createGracefulShutdown(
  app: FastifyInstance,
  options: ShutdownOptions = {}
): (signal: string) => Promise<void> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  let shuttingDown = false;

  return async function shutdown(signal: string): Promise<void> {
    if (shuttingDown) {
      app.log.warn({ signal }, 'Shutdown already in progress, ignoring signal');
      return;
    }
    shuttingDown = true;

    app.log.info({ signal }, 'Signal received, starting graceful shutdown');

    // Force exit if drain takes longer than timeoutMs (e.g. idle keep-alive connections)
    const forceTimer = setTimeout(() => {
      app.log.fatal({ timeoutMs }, 'Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, timeoutMs);
    forceTimer.unref();

    try {
      app.log.info('Waiting for in-flight requests to complete');
      // Stops accepting new connections, drains active requests, then runs onClose hooks
      await app.close();
      clearTimeout(forceTimer);
      app.log.info('Graceful shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceTimer);
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };
}

/**
 * Registers SIGTERM and SIGINT handlers that trigger a graceful shutdown.
 * Call once after the server has started listening.
 */
export function registerShutdown(app: FastifyInstance, options: ShutdownOptions = {}): void {
  const shutdown = createGracefulShutdown(app, options);

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  app.log.info('Graceful shutdown handlers registered (SIGTERM, SIGINT)');
}
