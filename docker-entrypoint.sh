#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
node dist/migrate.js

echo "[entrypoint] Starting API server..."
exec node dist/app.js
