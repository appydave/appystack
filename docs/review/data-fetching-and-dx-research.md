# Data Fetching & DX Tooling Research for AppyStack Template

**Date**: 2026-02-15
**Context**: Research for the AppyStack boilerplate template (React 19 + Vite 6 + Express 5 + TypeScript)
**Current state**: Template plan uses bare `fetch()` in a `useEffect` hook with no AbortController, no timeout, no caching, no retry logic.

---

## 1. Modern React Data Fetching in 2026: The Landscape

### The Four Options

| Approach | Complexity | Bundle Size | Caching | DevTools | Community Adoption |
|----------|-----------|-------------|---------|----------|-------------------|
| Bare `fetch` + `useEffect` | Low | 0 KB | None | None | Universal baseline |
| React 19 `use()` + Suspense | Medium | 0 KB | None built-in | None | Early adoption, caveats |
| SWR | Low-Medium | ~4.2 KB gzip | Stale-while-revalidate | Community only | Moderate |
| TanStack Query | Medium | ~12 KB gzip | Full (GC, stale time, invalidation) | Official DevTools | Dominant |

### Community Consensus (Feb 2026)

**TanStack Query is the clear winner for production apps.** It dominates starter templates, has the best DevTools, and handles the full lifecycle (queries, mutations, optimistic updates, pagination, infinite scroll, offline support). The npm download trend shows TanStack Query pulling significantly ahead of SWR.

**However, for a starter template**, the answer is more nuanced. See Section 3.

### What Popular Starter Templates Actually Include

Surveying high-star Vite + React templates on GitHub in 2025-2026:

- **[vite-react-boilerplate](https://github.com/RicardoValdovinos/vite-react-boilerplate)** (batteries-included): TanStack Query + DevTools
- **[React-Vite-Tanstack-Starter-Template](https://github.com/whereissam/React-Vite-Tanstack-Starter-Template)**: TanStack Query + TanStack Router
- **[vite-react-starter](https://github.com/dmarafetti/vite-react-starter)**: React Query (TanStack Query)
- **[Vite official template](https://vite.dev/guide/)**: Bare fetch (no data library)
- **[bulletproof-react](https://github.com/alan2207/bulletproof-react)**: TanStack Query (referenced in AppyStack's architecture.md)

**Pattern**: Minimal templates use bare fetch. Opinionated/production templates use TanStack Query. Almost nobody ships SWR in new templates in 2026.

### React 19 `use()` Hook with Suspense

React 19 introduced the `use()` hook, which accepts a promise and suspends the component until it resolves:

```tsx
import { use, Suspense } from 'react';

// Create the promise OUTSIDE the component (important!)
function fetchUser() {
  return fetch('/api/user').then((res) => res.json());
}

// Resource pattern: promises created at module level or in event handlers
function createUserResources() {
  const userPromise = fetchUser();
  const ordersPromise = userPromise.then((user) => fetchOrders(user.id));
  return { userPromise, ordersPromise };
}

// Component using use()
function Profile({ userPromise }: { userPromise: Promise<User> }) {
  const user = use(userPromise); // suspends until resolved
  return <h2>Welcome, {user.name}</h2>;
}

// Parent with Suspense boundary
function App() {
  const { userPromise } = createUserResources();
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile userPromise={userPromise} />
    </Suspense>
  );
}
```

**Caveats from TkDodo (TanStack Query maintainer):**
- React 19 changed Suspense sibling rendering behavior, creating **waterfalls instead of parallel fetching** when multiple `<Suspense>`-using components are siblings
- The `use()` hook provides no caching, no deduplication, no background refetching
- You must create promises outside components (the "render-as-you-fetch" pattern), which is architecturally demanding
- TkDodo recommends using route loaders (TanStack Router) to preload data before rendering

**Verdict**: `use()` is a primitive, not a solution. It is the building block that libraries like TanStack Query will use internally. Do not use it directly for data fetching in production apps.

Sources:
- [TkDodo: React 19 and Suspense - A Drama in 3 Acts](https://tkdodo.eu/blog/react-19-and-suspense-a-drama-in-3-acts)
- [freeCodeCamp: The Modern React Data Fetching Handbook](https://www.freecodecamp.org/news/the-modern-react-data-fetching-handbook-suspense-use-and-errorboundary-explained/)
- [React docs: use()](https://react.dev/reference/react/use)

---

## 2. AbortController in useEffect: The Proper Pattern

If sticking with bare fetch, this is the correct cleanup pattern:

```tsx
import { useState, useEffect } from 'react';

interface UseServerStatusResult {
  data: ServerInfo | null;
  loading: boolean;
  error: string | null;
}

export function useServerStatus(): UseServerStatusResult {
  const [data, setData] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStatus() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/info', {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const json = await response.json();
        setData(json);
      } catch (err) {
        // AbortError is expected on cleanup — not a real error
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Component unmounted, ignore silently
        }
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        // Only update loading if not aborted
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchStatus();

    // Cleanup: abort the in-flight request when component unmounts or deps change
    return () => {
      controller.abort();
    };
  }, []);

  return { data, loading, error };
}
```

### With Timeout Support

```tsx
useEffect(() => {
  const controller = new AbortController();

  // Timeout: abort after 10 seconds
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  async function fetchStatus() {
    try {
      const response = await fetch('/api/info', { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      clearTimeout(timeoutId);
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  fetchStatus();
  return () => {
    clearTimeout(timeoutId);
    controller.abort();
  };
}, []);
```

### Is This Boilerplate or Best Practice?

**It is best practice that every production useEffect+fetch should include.** The AbortController pattern:
- Prevents race conditions (fast remount/re-render)
- Prevents memory leaks (state updates on unmounted components)
- Conserves network resources (cancels unnecessary in-flight requests)
- React's own docs recommend it

**It is also boilerplate** -- this is exactly the kind of thing that TanStack Query eliminates. Every `useQuery` call handles abort, timeout, caching, and retry automatically.

Sources:
- [j-labs: AbortController in React](https://www.j-labs.pl/en/tech-blog/how-to-use-the-useeffect-hook-with-the-abortcontroller/)
- [LocalCan: AbortController Complete Guide](https://www.localcan.com/blog/abortcontroller-nodejs-react-complete-guide-examples)
- [LogRocket: useEffect cleanup](https://blog.logrocket.com/understanding-react-useeffect-cleanup-function/)

---

## 3. TanStack Query vs SWR vs Bare Fetch for a Template

### Setup Cost Comparison

**Bare fetch + useEffect** (0 dependencies, ~30 lines per hook):
```tsx
// No provider needed. Each hook is self-contained but verbose.
// Total setup: 0 lines of infrastructure
// Per-hook cost: ~25-35 lines including AbortController + error handling
```

**SWR** (1 dependency, ~5 lines per hook):
```bash
npm install swr  # ~4.2 KB gzip
```
```tsx
// No provider needed (optional SWRConfig for global settings)
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function useServerStatus() {
  const { data, error, isLoading } = useSWR('/api/info', fetcher);
  return { data, error: error?.message ?? null, loading: isLoading };
}
```

**TanStack Query** (1-2 dependencies, ~5 lines per hook + provider):
```bash
npm install @tanstack/react-query           # ~12 KB gzip
npm install @tanstack/react-query-devtools   # dev only
```
```tsx
// main.tsx — provider required (3 lines)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);
```
```tsx
// Per-hook: ~5 lines
import { useQuery } from '@tanstack/react-query';

function useServerStatus() {
  return useQuery({
    queryKey: ['serverInfo'],
    queryFn: () => fetch('/api/info').then((r) => r.json()),
  });
}
```

### Feature Comparison for Template Use Cases

| Feature | Bare fetch | SWR | TanStack Query |
|---------|-----------|-----|----------------|
| Auto abort on unmount | Manual | Yes | Yes |
| Caching | No | Stale-while-revalidate | Full (GC, stale time) |
| Background refetching | No | Yes | Yes |
| Request deduplication | No | Yes | Yes |
| Retry on failure | No | Yes (3x default) | Yes (3x default) |
| DevTools | No | Community | Official |
| Mutations | N/A | `useSWRMutation` | `useMutation` (optimistic updates) |
| Pagination | Manual | Manual | Built-in `useInfiniteQuery` |
| Offline support | No | No | Yes |
| Bundle size | 0 KB | ~4.2 KB | ~12 KB |
| Setup overhead | 0 files | 0-1 files | 1-2 files |

### Recommendation for AppyStack Template

**Use bare fetch with AbortController in the template. Document TanStack Query as the recommended upgrade path.**

Rationale:
1. **A template should be minimal and unopinionated.** Adding TanStack Query means the template now teaches/requires understanding of QueryClient, QueryClientProvider, query keys, cache invalidation patterns, and DevTools setup. That is a lot of surface area for what is supposed to be a starting point.

2. **The template's fetch calls are trivial.** The boilerplate template fetches `/health` and `/api/info` on mount. These are one-shot reads with no mutations, no pagination, no real-time updates. TanStack Query is overkill here.

3. **Easy upgrade path.** The hook pattern (`useServerStatus`) is already abstracted. When a consumer project needs caching/mutations, they install TanStack Query and rewrite the hook internals without changing any component code.

4. **Architecture docs already mention TanStack Query.** The `architecture.md` lists it under "State & Routing (Optional)" with version `^5.87.1`. This is the right positioning.

**What belongs in the template:**
- `useServerStatus` hook with AbortController + timeout + proper error handling
- A comment block in the hook file: `// For production apps with complex data needs, consider @tanstack/react-query`
- The architecture.md already covers TanStack Query as an optional dependency

**If you decide to include TanStack Query anyway:**
- Add `@tanstack/react-query` to client `dependencies`
- Add `@tanstack/react-query-devtools` to client `devDependencies`
- Wrap `<App>` in `QueryClientProvider` in `main.tsx`
- Rewrite `useServerStatus` to use `useQuery`
- Total added complexity: ~15 lines of infrastructure + 1 dependency

Sources:
- [TanStack Query Quick Start](https://tanstack.com/query/latest/docs/framework/react/quick-start)
- [TanStack official comparison table](https://tanstack.com/query/latest/docs/framework/react/comparison)
- [Refine: React Query vs TanStack Query vs SWR 2025](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/)
- [LogRocket: SWR vs TanStack Query](https://blog.logrocket.com/swr-vs-tanstack-query-react/)

---

## 4. Production Deployment Patterns for RVETS Monorepos

### Do Reference Templates Include Dockerfiles?

**Yes, production-oriented ones do.** The [vite-react-express-docker-boilerplate](https://github.com/joeynguyen/vite-react-express-docker-boilerplate) is the most directly comparable reference. Minimal starter templates (Vite official, create-react-app) do not.

**For AppyStack**: A Dockerfile should be in the template but not in Phase 1-4. It is a Phase 5+ addition. The template's primary value is DX, not deployment.

### Multi-Stage Dockerfile for RVETS Monorepo

```dockerfile
# === Stage 1: Build ===
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files for all workspaces
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build shared first, then server, then client
RUN npm run build -w shared
RUN npm run build -w server
RUN npm run build -w client

# === Stage 2: Production ===
FROM node:20-alpine AS production

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/client/dist ./client/dist

# Server serves the client build in production
EXPOSE 5501

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
```

### Express Static File Serving for SPA

The server needs to serve the Vite-built client in production:

```typescript
// server/src/index.ts — production static serving
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';

const app = express();

// ... middleware, routes, socket.io setup ...

// In production, serve the built client
if (env.isProduction) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.join(__dirname, '../../client/dist');

  // Serve static assets with caching headers
  app.use(
    express.static(clientDist, {
      maxAge: '1y',          // Cache static assets aggressively
      immutable: true,       // Vite hashes filenames, so immutable is safe
      index: false,          // Don't serve index.html for directory requests (SPA fallback handles it)
    })
  );

  // SPA fallback: all non-API routes serve index.html
  app.get('*', (req, res) => {
    // Skip API routes and socket.io
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io') || req.path.startsWith('/health')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

### Environment Variable Injection for the Client

Vite bakes `VITE_*` environment variables into the bundle at build time via `import.meta.env`. This creates a challenge for Docker deployments where you want the same image across environments.

**Option A: Build-time injection (simplest, one image per environment)**
```dockerfile
# Build with environment-specific variables
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w client
```
```bash
docker build --build-arg VITE_API_URL=https://api.prod.example.com -t myapp:prod .
```

**Option B: Runtime config endpoint (one image, all environments)**
```typescript
// server/src/routes/config.ts
import { Router } from 'express';
import { env } from '../config/env.js';

const router = Router();

router.get('/api/config', (req, res) => {
  res.json({
    apiUrl: env.PUBLIC_API_URL,
    environment: env.NODE_ENV,
    // Only expose safe, public values here
  });
});

export default router;
```
```tsx
// client/src/hooks/useConfig.ts
// Fetch runtime config on app startup instead of using import.meta.env
```

**Option C: Template replacement at container start (common in Nginx setups)**
```bash
# entrypoint.sh — replaces __VITE_API_URL__ in built JS files
envsubst < /app/client/dist/index.html > /app/client/dist/index.html.tmp
mv /app/client/dist/index.html.tmp /app/client/dist/index.html
```

**Recommendation for AppyStack template**: Use Option A (build-time injection) for simplicity. Document Option B in architecture.md for teams that need single-image-multi-environment deployments.

### Nginx/Caddy Reverse Proxy (Production)

For production deployments behind a reverse proxy:

**Nginx configuration** (serves client static files, proxies API to Express):
```nginx
server {
    listen 80;
    server_name example.com;

    # Serve Vite-built client
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;

        # Vite hashes filenames, so aggressive caching is safe
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Proxy API requests to Express
    location /api/ {
        proxy_pass http://express-server:5501;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Proxy WebSocket connections
    location /socket.io/ {
        proxy_pass http://express-server:5501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

**docker-compose.yml** (complete production setup):
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5501:5501"
    environment:
      - NODE_ENV=production
      - PORT=5501
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:5501/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Optional: Nginx reverse proxy (if not using Express to serve static files)
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app
    restart: unless-stopped
```

### Recommendation for AppyStack Template

**Include in the template:**
- A `Dockerfile` with multi-stage build (build + production stages)
- A `docker-compose.yml` for local Docker testing
- A `.dockerignore` file
- Express static serving code gated behind `env.isProduction`

**Do NOT include:**
- Nginx config (too deployment-specific)
- Kubernetes manifests
- Cloud-specific deployment configs (AWS, GCP, etc.)
- CI/CD deployment pipelines beyond the existing `ci.yml`

Sources:
- [vite-react-express-docker-boilerplate](https://github.com/joeynguyen/vite-react-express-docker-boilerplate)
- [Docker: How to Dockerize a React App](https://www.docker.com/blog/how-to-dockerize-react-app/)
- [BuildWithMatija: React Vite Docker Nginx Production](https://www.buildwithmatija.com/blog/production-react-vite-docker-deployment)
- [Vite docs: Env Variables and Modes](https://vite.dev/guide/env-and-mode)
- [Labod: SPA Environment Variables](https://labod.co/post/2025/03/14/spa-environment-variables.html)

---

## 5. ESLint Config Pre-Publish Workarounds

### The Problem

AppyStack's `config/` package needs to be consumed by the `template/` project during local development, before the package is published to npm. ESLint 9 flat configs import plugins as JavaScript modules, so the resolution path matters.

### Option A: `file:` Protocol in package.json (Current Approach)

```json
{
  "devDependencies": {
    "@appydave/appystack-config": "file:../config"
  }
}
```

**Pros**: Simple, works with `npm install`, no extra tools
**Cons**: Creates a symlink, which can cause ESLint plugin resolution issues. Peer dependencies are not installed automatically. If the config package declares `eslint-plugin-react` as a peerDependency, the consumer MUST also install it explicitly.

**Workaround for peer deps**: Install all peer dependencies explicitly in the consumer:
```json
{
  "devDependencies": {
    "@appydave/appystack-config": "file:../config",
    "@eslint/js": "^9.39.2",
    "@typescript-eslint/eslint-plugin": "^8.20.0",
    "@typescript-eslint/parser": "^8.20.0",
    "eslint": "^9.39.2",
    "eslint-plugin-react": "^7.37.3",
    "eslint-plugin-react-hooks": "^5.1.0",
    "globals": "^15.14.0"
  }
}
```

**This is actually the correct approach** because ESLint flat configs resolve plugins from the importing project's `node_modules`, not from the config package's `node_modules`. The peer dependencies are just documentation of what the consumer needs.

### Option B: npm link

```bash
# In config/
cd /Users/davidcruwys/dev/ad/apps/appystack/config
npm link

# In template/
cd /Users/davidcruwys/dev/ad/apps/appystack/template
npm link @appydave/appystack-config
```

**Pros**: Changes in config/ are immediately reflected (symlink)
**Cons**: Known issue with ESLint: [eslint/eslint#6222](https://github.com/eslint/eslint/issues/6222) -- ESLint does not resolve plugin dependencies through symlinks. You must still install all plugins in the consumer project. npm link also modifies the global npm prefix, which can cause conflicts.

**Verdict**: Works, but fragile. The `file:` approach is better for this monorepo setup.

### Option C: yalc (Recommended for Pre-Publish Testing)

[yalc](https://github.com/wclr/yalc) simulates a real npm publish locally:

```bash
# Install yalc globally
npm install -g yalc

# In config/ — publish to local store
cd /Users/davidcruwys/dev/ad/apps/appystack/config
yalc publish

# In template/ — add from local store
cd /Users/davidcruwys/dev/ad/apps/appystack/template
yalc add @appydave/appystack-config
npm install
```

**Development loop:**
```bash
# After making changes to config/
cd /Users/davidcruwys/dev/ad/apps/appystack/config
yalc push  # publishes + propagates to all linked projects

# Or with --changed flag (skip if nothing changed)
yalc push --changed
```

**Key advantage**: yalc copies files (like `npm pack`), it does not symlink. This means ESLint resolves plugins exactly as it would with a real npm install. Peer dependencies still need to be installed in the consumer, but module resolution works correctly.

**Cleanup:**
```bash
# Add to .gitignore
.yalc/
yalc.lock
```

**Watch mode for continuous development:**
```bash
# In config/ — rebuild and push on every change
# (hook into your build:watch script)
nodemon --watch . --ext js,json,ts --exec "yalc push --changed"
```

### Option D: npm Workspaces (Monorepo Hoisting)

Since `config/` and `template/` are in the same repo, you could add a root `package.json` with workspaces:

```json
{
  "private": true,
  "workspaces": ["config", "template"]
}
```

**Pros**: npm handles linking automatically, peer deps are hoisted
**Cons**: This changes the repo structure significantly. The AppyStack repo is `config/ + docs/`, not a workspace monorepo. Adding the template as a workspace sibling to config creates a nested workspace situation (template itself has client/server/shared workspaces). npm does not support nested workspaces well.

**Verdict**: Not recommended for AppyStack's structure.

### Recommendation for AppyStack

**Use `file:` protocol for now. Switch to yalc when testing the pre-publish workflow.**

The development loop:
1. **Day-to-day development**: `file:../config` in template's `package.json`. Run `npm install` after config changes. This is what the template plan already specifies.
2. **Pre-publish testing**: Use yalc to verify the package works as a real npm install before `npm publish --access public`.
3. **Post-publish**: Replace `file:../config` with `@appydave/appystack-config` from npm.

**Critical note for ESLint 9 flat configs**: Regardless of which linking approach you use, the consumer project MUST have all ESLint plugins installed in its own `node_modules`. This is by design -- flat configs import plugins as ES modules, and module resolution starts from the importing file's location, not the config package's location. The config package's `peerDependencies` field documents this requirement.

Sources:
- [yalc GitHub repo](https://github.com/wclr/yalc)
- [ESLint: Shareable Configs](https://eslint.org/docs/latest/extend/shareable-configs)
- [ESLint issue #6222: npm link plugin resolution](https://github.com/eslint/eslint/issues/6222)
- [typescript-eslint: Local Linking](https://typescript-eslint.io/contributing/local-development/local-linking/)
- [Viget: How to use local Node packages](https://www.viget.com/articles/how-to-use-local-unpublished-node-packages-as-project-dependencies)
- [Olivia Coumans: yalc for local testing](https://oliviac.dev/blog/test-packages-locally-before-publishing-yalc/)

---

## Summary of Recommendations

| Question | Recommendation | Confidence |
|----------|---------------|------------|
| Data fetching in template | Bare fetch + AbortController + timeout | High |
| Data fetching upgrade path | TanStack Query (already in architecture.md) | High |
| React 19 `use()` hook | Do not use directly; wait for library integration | High |
| SWR | Skip; TanStack Query has won the ecosystem | High |
| Dockerfile in template | Yes, multi-stage build (post Phase 4) | Medium |
| Production static serving | Express serves client/dist in production | High |
| Env vars for client | Build-time injection (document runtime option) | Medium |
| Nginx config in template | No, too deployment-specific | High |
| ESLint config dev workflow | `file:` protocol now, yalc for pre-publish testing | High |
| Nested npm workspaces | No, does not fit repo structure | High |

### Concrete Next Actions for the Template

1. **Update `useServerStatus` hook** to include AbortController + timeout (pattern from Section 2)
2. **Add a comment** in the hook pointing to TanStack Query as the upgrade path
3. **Add production static serving** to the server's `index.ts` (gated behind `env.isProduction`)
4. **Create a Dockerfile** and `docker-compose.yml` as a post-Phase-5 addition
5. **Keep `file:../config`** for the ESLint config reference; add yalc instructions to the publishing section of architecture.md
6. **Add `.dockerignore`** to the template
