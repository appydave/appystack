# Deployment

> How to build, containerise, and deploy an AppyStack RVETS application to production.

---

## Production Build

The root `build` script compiles all three workspaces in dependency order:

```bash
npm run build
# expands to:
npm run build -w shared && npm run build -w server && npm run build -w client
```

`shared` must compile first because both `server` and `client` import from
`@appystack-template/shared`. Building out of order causes TypeScript to fail.

### Build Outputs

| Workspace | Output directory   | Entry point              |
|-----------|--------------------|--------------------------|
| shared    | `shared/dist/`     | `shared/dist/index.js`   |
| server    | `server/dist/`     | `server/dist/index.js`   |
| client    | `client/dist/`     | `client/dist/index.html` |

### What tsc-alias Does

The server build script (`server/package.json`) runs:

```bash
tsc && tsc-alias
```

`tsc` compiles TypeScript but leaves path aliases (e.g., `@appystack-template/shared`)
in the emitted `.js` files. Node cannot resolve those aliases at runtime.
`tsc-alias` post-processes `server/dist/` and rewrites every aliased import to
a relative path. Skipping `tsc-alias` causes the server to crash on startup
with `ERR_MODULE_NOT_FOUND`.

---

## Docker

A `Dockerfile` is included at `template/Dockerfile` and uses a two-stage build.

```bash
# Build the image
docker build -t my-app:latest .

# Run with required environment variables
docker run -p 5501:5501 \
  -e NODE_ENV=production \
  -e CLIENT_URL=https://app.example.com \
  my-app:latest
```

**Stage 1 — builder** (`node:20-alpine`): installs all dependencies (including
devDependencies), copies source, and runs `npm run build`.

**Stage 2 — production** (`node:20-alpine`): reinstalls production-only
dependencies (`npm ci --omit=dev`), copies compiled artifacts from the builder
stage, exposes port `5501`, and starts the server with `node server/dist/index.js`.

The Dockerfile includes a built-in health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5501/health || exit 1
```

No `docker-compose.yml` is included. For multi-service setups (e.g., adding a
database), add one at the repo root and pass env vars via the `environment:` key.

---

## Environment Variables

The server validates variables on startup via Zod (`server/src/config/env.ts`).
Any validation failure logs to stderr and calls `process.exit(1)` — the server
will not start.

### Required Variables

| Variable     | Default (dev)           | Production value           |
|--------------|-------------------------|----------------------------|
| `NODE_ENV`   | `development`           | `production`               |
| `PORT`       | `5501`                  | `5501` (or platform port)  |
| `CLIENT_URL` | `http://localhost:5500` | `https://app.example.com`  |

`CLIENT_URL` controls both the HTTP CORS header and the Socket.io CORS origin.
It must match the exact origin browsers use to reach the client.

### Client-side Variables (Vite)

`VITE_*` variables are embedded at **build time** — set them before `npm run build`:

| Variable        | Example                    |
|-----------------|----------------------------|
| `VITE_API_URL`  | `https://app.example.com`  |
| `VITE_APP_NAME` | `My App`                   |

### Passing Variables

Use a `.env` file (do not commit secrets), system environment exports, or
Docker's `--env-file` flag:

```bash
docker run --env-file .env.production -p 5501:5501 my-app:latest
```

See `.env.example` in the template root for the full variable list.

---

## Health Check Endpoint

`GET /health` is implemented in `server/src/routes/health.ts` and is required
for production deployments.

Response (always HTTP 200):

```json
{ "status": "ok", "timestamp": "2026-02-27T10:00:00.000Z" }
```

### Load Balancer

Probe `GET /health` on port `5501`. Remove the instance from rotation on any
non-`200` response or TCP failure.

### Kubernetes Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 5501
  initialDelaySeconds: 10
  periodSeconds: 30
  timeoutSeconds: 5
  failureThreshold: 3
```

---

## CORS Configuration

Both HTTP CORS and Socket.io CORS are driven by `CLIENT_URL` in
`server/src/index.ts`:

```typescript
app.use(cors({ origin: env.CLIENT_URL }));
const io = new Server(httpServer, {
  cors: { origin: env.CLIENT_URL, methods: ['GET', 'POST'] },
});
```

### Multiple Origins

To allow several origins (e.g., apex + `www`), extend `env.ts` and update
`index.ts`:

```typescript
// env.ts — parse a comma-separated list
CLIENT_ORIGINS: z.string().default('http://localhost:5500'),

// index.ts
const allowedOrigins = env.CLIENT_ORIGINS.split(',').map(o => o.trim());
app.use(cors({ origin: allowedOrigins }));
```

```bash
CLIENT_ORIGINS=https://app.example.com,https://www.example.com
```

---

## Static File Serving

When `NODE_ENV=production`, Express serves the compiled React app from
`client/dist/` (`server/src/index.ts`):

```typescript
if (env.isProduction) {
  const clientDist = join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // SPA fallback — serve index.html for all non-API routes
  app.get('*splat', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}
```

`express.static` serves hashed assets. The `*splat` catch-all returns
`index.html` for any unmatched path, enabling client-side routing without 404s.

> `*splat` is the Express 5 wildcard syntax. The Express 4 `*` wildcard silently
> fails to match in Express 5 — do not use it.

API routes (`/health`, `/api/*`) are mounted before the static middleware and
are never intercepted by the SPA fallback. In development, Vite handles the
client on port `5500` and static serving is disabled.

---

## Production Checklist

- [ ] `NODE_ENV=production` — enables static file serving, disables dev middleware
- [ ] `CLIENT_URL` set to exact production origin (scheme, host, port if non-standard)
- [ ] All `VITE_*` variables set at **build time** before `npm run build`
- [ ] `npm run build` completed without errors; `server/dist/index.js` and `client/dist/index.html` exist
- [ ] `tsc-alias` ran as part of server build (check `server/package.json` `build` script)
- [ ] `/health` returns `{"status":"ok"}` after deploy — required, do not skip
- [ ] Load balancer or Kubernetes probe configured to use `GET /health`
- [ ] HTTPS terminated at the load balancer or reverse proxy (Express does not handle TLS)
- [ ] Helmet is active (enabled by default in `server/src/index.ts`) — sets security headers
- [ ] Rate limiting is applied via `apiLimiter` (100 req / 15 min per IP); tune in `server/src/middleware/rateLimiter.ts`
- [ ] Pino log level is `info` or higher in production — avoid `debug`/`trace`
- [ ] No `.env` files with secrets committed to source control
- [ ] Production image installs only production dependencies (`npm ci --omit=dev`)
- [ ] Process manager sends `SIGTERM` and waits for clean exit — the server listens for `SIGTERM`/`SIGINT`, closes Socket.io, then closes HTTP before `process.exit(0)`
- [ ] Socket.io `CLIENT_URL` origin matches the HTTP CORS origin — both read from the same env var, verify if you customised the Socket.io initialisation
