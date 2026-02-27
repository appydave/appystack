# Environment Variables

> Reference for all environment variables used in the AppyStack template, covering server-side Zod validation, client-side VITE_ conventions, and secrets management.

## Quick Reference

### Server Variables

| Variable     | Default                 | Required | Description                                          |
|--------------|-------------------------|----------|------------------------------------------------------|
| `NODE_ENV`   | `development`           | No       | Runtime mode: `development`, `production`, or `test` |
| `PORT`       | `5501`                  | No       | Port the Express server listens on                   |
| `CLIENT_URL` | `http://localhost:5500` | No       | Allowed CORS origin for the client                   |

### Client Variables

| Variable        | Default                 | Required | Description                                      |
|-----------------|-------------------------|----------|--------------------------------------------------|
| `VITE_API_URL`  | `http://localhost:5501` | No       | Base URL the client uses to reach the API server |
| `VITE_APP_NAME` | `AppyStack`             | No       | Application display name                         |

All server variables have defaults so the server starts without any `.env` file present. Set client variables explicitly for production deployments.

---

## Server Variables

### Zod Validation in `env.ts`

Server variables are validated at startup in `template/server/src/config/env.ts`:

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5501),
  CLIENT_URL: z.string().default('http://localhost:5500'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
```

`z.coerce.number()` converts the `PORT` string from `process.env` to a number. `safeParse` catches failures gracefully and calls `process.exit(1)` with a clear error message.

Note: `console.error` is used rather than the Pino logger because `env.ts` is imported by the logger config, creating a circular dependency if the logger were used here.

### Derived Flags

`env.ts` exports convenience booleans derived from `NODE_ENV`:

- `env.isDevelopment`, `env.isProduction`, `env.isTest`

Use these flags in application code rather than comparing `NODE_ENV` strings directly.

---

## Client Variables

### The VITE_ Prefix Requirement

Vite only exposes variables prefixed with `VITE_` to client-side code. Variables without this prefix are never bundled into the client. Do not put secrets in `VITE_` variables.

Access variables through `import.meta.env` and always provide a fallback:

```typescript
const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5501';
const appName = import.meta.env.VITE_APP_NAME ?? 'AppyStack';
```

### Type Declarations in `vite-env.d.ts`

`template/client/src/vite-env.d.ts` declares TypeScript types for client env vars. All `VITE_` variables are typed as `string | undefined` — always provide a fallback when reading them:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
}
```

### Client-Side Validation Pattern (WU-8)

`vite-env.d.ts` provides type safety but no runtime validation. WU-8 introduces `client/src/config/env.ts` to mirror the server pattern: parse `import.meta.env` through a schema and export a typed `clientEnv` object. Until then, use `import.meta.env` directly with fallbacks.

---

## How to Add a New Environment Variable

### Server: Extend the Zod Schema

Add the variable to the schema in `template/server/src/config/env.ts`:

```typescript
const envSchema = z.object({
  // existing vars...
  DATABASE_URL: z.string().url(),                        // required, no default
  MAX_CONNECTIONS: z.coerce.number().min(1).default(10), // optional with default
});
```

Add the variable to `template/.env.example` so other developers know it exists.

### Client: Add to `vite-env.d.ts`

Add the declaration to `template/client/src/vite-env.d.ts`:

```typescript
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_FEATURE_FLAG?: string;  // add here
}
```

When `client/src/config/env.ts` exists (after WU-8), also add the variable to the `clientEnv` object in that file. Add all new client variables to `.env.example`.

---

## Secrets Management

### Never Commit `.env`

The `.env` file contains real credentials and must never be committed. Confirm it is in `.gitignore` before adding any secrets.

Use `.env.example` as documentation — it is the source of truth for what variables exist. New developers copy it and fill in real values:

```bash
cp .env.example .env
```

The current `template/.env.example`:

```
# TODO: Update these values for your project
NODE_ENV=development
PORT=5501
CLIENT_URL=http://localhost:5500
VITE_API_URL=http://localhost:5501
VITE_APP_NAME=AppyStack
```

Before committing, verify `.env` has not been accidentally staged:

```bash
git status              # .env must not appear in tracked files
git diff .env.example   # only intentional documentation changes
```

---

## CI Secrets

The GitHub Actions workflow at `template/.github/workflows/ci.yml` runs lint, format check, build, and tests. The current workflow requires no secrets.

### NPM_TOKEN for Publishing

Publishing `@appydave/appystack-config` requires an `NPM_TOKEN`. Add it in GitHub repository Settings > Secrets and variables > Actions, then reference it in the publish step:

```yaml
- name: Publish to npm
  run: npm publish --access public
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

All other CI secrets follow the same pattern: add in GitHub settings, reference via `${{ secrets.SECRET_NAME }}`.

---

## Environment-Specific Files

Vite loads `.env` files in precedence order based on the current `NODE_ENV` mode:

| File                     | Committed | Purpose                                 |
|--------------------------|-----------|------------------------------------------|
| `.env.example`           | Yes       | Documentation of all required variables |
| `.env`                   | No        | Local developer values                  |
| `.env.development`       | Yes       | Shared development defaults             |
| `.env.production`        | Yes       | Shared production defaults (no secrets) |
| `.env.local`             | No        | Personal overrides, gitignored          |

Only commit files that contain no secrets — safe defaults or empty placeholders only.

### NODE_ENV in Test Runs

Vitest sets `NODE_ENV=test` automatically. The server guards its `listen()` call using `env.isTest` to prevent `EADDRINUSE` errors when multiple test files import the server module in parallel:

```typescript
if (!env.isTest) {
  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}
```
