/**
 * Vitest setupFiles — runs before each test file in the test process.
 * Loads .env.test BEFORE src/config/env.ts is imported by the app,
 * so dotenv.config() in env.ts won't override these values.
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.test'), override: true });
