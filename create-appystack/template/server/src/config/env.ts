import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Precedence must flip between test and runtime:
//  - Under test, the values a test sets on process.env must win (override OFF), or env.test.ts
//    can never inject its inputs.
//  - At runtime (dev / prod / Overmind), .env must win over any stale or injected PORT (override
//    ON), or the server can silently bind the wrong port.
//    See docs/kdd/learnings/dotenv-override-clobbers-env-tests.md for the full rationale.
const underTest = process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
dotenv.config({ path: path.resolve(process.cwd(), '..', '.env'), override: !underTest });

const envSchema = z.object({
  // TODO: Update defaults for your project
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5501),
  // Bind address. Defaults to loopback so a dev server is NOT exposed to the
  // local network (café/hotel wifi) by accident. Set HOST=0.0.0.0 to serve all
  // interfaces — e.g. to reach this machine's app from another over Tailscale.
  HOST: z.string().default('127.0.0.1'),
  CLIENT_URL: z.string().default('http://localhost:5500'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

/**
 * Validated server environment configuration loaded from .env via Zod.
 * Includes NODE_ENV, PORT, HOST, CLIENT_URL, and derived boolean flags (isDevelopment, isProduction, isTest).
 */
export const env = {
  ...parsed.data,
  isDevelopment: parsed.data.NODE_ENV === 'development',
  isProduction: parsed.data.NODE_ENV === 'production',
  isTest: parsed.data.NODE_ENV === 'test',
};
