import fp from 'fastify-plugin';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { env } from '../config/env';
import { verifyAccessToken } from '../modules/auth/jwt';
import { RedisPresenceStore } from '../modules/presence/redis-store';
import { PresenceService } from '../modules/presence/service';
import type { ServerToClientEvents, ClientToServerEvents, SocketData } from './events';

type IoServer = Server<ClientToServerEvents, ServerToClientEvents, Record<never, never>, SocketData>;

// Make io accessible across the app (e.g. matchmaking controller emitting match:created)
declare module 'fastify' {
  interface FastifyInstance {
    io: IoServer;
  }
}

export const gatewayPlugin = fp(
  async (app: FastifyInstance, _opts: FastifyPluginOptions): Promise<void> => {
    const io: IoServer = new Server(app.server, {
      cors: {
        origin: env.NODE_ENV !== 'production' ? '*' : false,
        credentials: true,
      },
      // Allow polling fallback for environments that block WebSocket upgrades.
      // Note: polling requires sticky sessions at the load balancer when running
      // multiple instances (see docker-compose.scale.yml).  WebSocket connections
      // are always persistent and do not need sticky sessions.
      transports: ['websocket', 'polling'],
    });

    // ── Redis Adapter ─────────────────────────────────────────────────────────
    // Replaces the default in-memory adapter with one backed by Redis Pub/Sub.
    //
    // With this adapter every Socket.IO operation — to(), fetchSockets(), and
    // room joins/leaves — is coordinated across all instances:
    //
    //   • app.io.to('user:X').emit(...)  reaches the user even if they connected
    //     to a different instance than the one handling the HTTP request.
    //
    //   • io.in('user:X').fetchSockets() returns sockets from ALL instances, so
    //     the presence offline-detection logic (sockets.length === 1) correctly
    //     counts the user's connections across the entire cluster.
    //
    // pubClient  → app.redis  (shared, not in subscribe mode — safe for regular
    //                          commands AND publishing adapter messages)
    // subClient  → app.redisSub  (dedicated connection that the adapter puts in
    //                             subscribe mode; cannot run regular commands)
    io.adapter(createAdapter(app.redis, app.redisSub));

    // ── Presence service ──────────────────────────────────────────────────────
    // The gateway creates its own service instance — it shares the pool with the
    // HTTP presence controller, which is safe (pg.Pool is designed for this).
    const presenceService = new PresenceService(new RedisPresenceStore(app.redis));

    // ── Auth middleware ───────────────────────────────────────────────────────
    // Token accepted from:
    //   1. socket.handshake.auth.token  (preferred — Socket.IO auth object)
    //   2. Authorization: Bearer <token>  (fallback for plain WS clients)
    io.use((socket, next) => {
      const auth = socket.handshake.auth as { token?: string };
      const token =
        auth.token ?? socket.handshake.headers['authorization']?.slice(7);

      if (!token) {
        return next(new Error('Authentication required'));
      }

      try {
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.sub;
        next();
      } catch {
        next(new Error('Invalid or expired token'));
      }
    });

    // ── Connection handler ────────────────────────────────────────────────────
    io.on('connection', (socket) => {
      const { userId } = socket.data;

      // Private user room — enables per-user broadcasts and multi-socket tracking.
      // All sockets for the same user share this room.
      void socket.join(`user:${userId}`);

      app.log.info({ event: 'ws.connect', userId, socketId: socket.id }, 'client connected');

      presenceService.setOnline(userId, socket.id).catch((err) => {
        app.log.error({ err, userId }, 'failed to set user online');
      });

      // `disconnecting` fires while the socket is still in its rooms.
      // This lets us count remaining connections before the socket leaves.
      socket.on('disconnecting', (reason) => {
        // io.in(room).fetchSockets() returns all sockets currently in the room,
        // including this one (it hasn't left yet). Length === 1 means last connection.
        io.in(`user:${userId}`)
          .fetchSockets()
          .then((sockets) => {
            app.log.info(
              { event: 'ws.disconnect', userId, socketId: socket.id, reason },
              'client disconnected'
            );

            if (sockets.length === 1) {
              // This is the last socket for this user — mark offline
              return presenceService.setOffline(userId);
            }
            // User still has other active connections — stay online
          })
          .catch((err) => {
            app.log.error({ err, userId }, 'failed to set user offline');
          });
      });
    });

    app.decorate('io', io);

    app.addHook('onClose', async () => {
      // HTTP server may not be listening when closing in test environments
      if (!app.server.listening) return;
      await new Promise<void>((resolve, reject) => {
        io.close((err) => (err ? reject(err) : resolve()));
      });
    });
  }
);
