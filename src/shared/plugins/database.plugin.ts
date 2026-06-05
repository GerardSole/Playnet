import fp from 'fastify-plugin';
import { Pool } from 'pg';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../../config/env';

declare module 'fastify' {
  interface FastifyInstance {
    pg: Pool;
  }
}

export const databasePlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    try {
      const client = await pool.connect();
      client.release();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`PostgreSQL connection failed: ${message}`);
    }

    app.log.info('PostgreSQL connected');
    app.decorate('pg', pool);

    app.addHook('onClose', async () => {
      await pool.end();
      app.log.info('PostgreSQL pool closed');
    });
  }
);
