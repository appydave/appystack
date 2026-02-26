# Developer Experience Tooling and Security Patterns Research

Research findings for AppyStack RVETS monorepo starter template (February 2026).

---

## 1. Git Hooks in 2026: Husky + lint-staged vs Alternatives

### Current Landscape

**Husky + lint-staged** remains the dominant combination in the JavaScript ecosystem with 7M+ weekly downloads for Husky. However, several credible alternatives have emerged.

### Tool Comparison

| Tool | Language | Config Format | Parallel Execution | Node.js Required | Weekly Downloads |
|------|----------|--------------|-------------------|-----------------|-----------------|
| [Husky](https://typicode.github.io/husky/) v9+ | JS/Shell | Shell scripts in `.husky/` | No (sequential) | Yes | ~7M |
| [lint-staged](https://github.com/lint-staged/lint-staged) | JS | JSON/JS in `package.json` | Per-glob parallel | Yes | ~5M |
| [Lefthook](https://github.com/evilmartians/lefthook) | Go | `lefthook.yml` | Yes (by default) | No | ~200K |
| [simple-git-hooks](https://github.com/toplenboren/simple-git-hooks) | JS | `package.json` | N/A | Yes | ~800K |

### Recommendation: Husky v9 + lint-staged

For an npm-ecosystem config package targeting TypeScript + React developers, **Husky + lint-staged is the correct choice**. Lefthook is technically superior (faster, parallel, polyglot) but the audience for AppyStack is JavaScript/TypeScript developers who expect the Husky workflow. Lefthook adds a Go binary dependency that is unusual in JS starter templates.

### Setup: Husky v9 + lint-staged

**Installation:**

```bash
npm install --save-dev husky lint-staged
npx husky init
```

**package.json:**

```json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix --no-warn-ignored",
      "prettier --write"
    ],
    "*.{js,jsx,mjs,cjs}": [
      "eslint --fix --no-warn-ignored",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml,css}": [
      "prettier --write"
    ]
  }
}
```

**.husky/pre-commit:**

```sh
npx lint-staged
```

> Note: Husky v9 no longer requires `#!/bin/sh` shebang or `husky install` in the prepare script. The simplified `"prepare": "husky"` is the current convention.

### Alternative: Lefthook (for reference)

If AppyStack later targets polyglot teams, here is the equivalent Lefthook config:

```yaml
# lefthook.yml
pre-commit:
  jobs:
    - name: lint
      glob: "*.{ts,tsx,js,jsx}"
      run: npx eslint --fix --no-warn-ignored {staged_files}
      stage_fixed: true

    - name: format
      glob: "*.{ts,tsx,js,jsx,json,md,yml,yaml,css}"
      run: npx prettier --write {staged_files}
      stage_fixed: true
```

### Alternative: simple-git-hooks (lightweight)

For minimal projects that do not need per-file glob filtering (lint-staged), simple-git-hooks is a zero-dependency option:

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged"
  }
}
```

Run `npx simple-git-hooks` after config changes. Used by Vue.js core and other projects that want minimal tooling.

### Sources

- [Husky Getting Started](https://typicode.github.io/husky/get-started.html)
- [lint-staged GitHub](https://github.com/lint-staged/lint-staged)
- [Lefthook GitHub](https://github.com/evilmartians/lefthook)
- [simple-git-hooks npm](https://www.npmjs.com/package/simple-git-hooks)
- [Lefthook vs Husky Comparison](https://www.edopedia.com/blog/lefthook-vs-husky/)
- [Prettier Pre-commit Docs](https://prettier.io/docs/precommit)

---

## 2. Rate Limiting for Express 5

### Should Starter Templates Include Rate Limiting?

**Yes.** Rate limiting is listed in the [official Express security best practices](https://expressjs.com/en/advanced/best-practice-security.html) and is trivial to include. The `express-rate-limit` package (v8.2.1, October 2025) has 508K+ dependent projects and works with Express 4 and 5.

Production Express starter templates like [express-typescript-boilerplate](https://github.com/edwinhern/express-typescript) include rate limiting as a standard middleware alongside Helmet and CORS.

### Current API (express-rate-limit v8)

```typescript
import { rateLimit } from 'express-rate-limit';

// Global rate limiter - sensible defaults for an API
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 100,                 // 100 requests per window per IP
  standardHeaders: 'draft-8', // RateLimit headers (IETF standard)
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  message: {
    status: 429,
    error: 'Too many requests, please try again later.',
  },
});

// Strict limiter for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many login attempts, please try again later.',
  },
});
```

### Recommended Starter Template Security Stack

```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';

const app = express();

// Security headers
app.use(helmet());

// CORS (configure origins for production)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5100',
  credentials: true,
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
```

### Key Configuration Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `windowMs` | number | 60000 | Time window in ms |
| `limit` | number \| function | 5 | Max requests per window |
| `standardHeaders` | `'draft-6'` \| `'draft-7'` \| `'draft-8'` | `'draft-6'` | IETF RateLimit headers |
| `legacyHeaders` | boolean | true | X-RateLimit-* headers |
| `keyGenerator` | function | IP-based | How to identify users |
| `store` | Store | MemoryStore | External store (Redis) |
| `skip` | function | - | Bypass conditions |
| `handler` | function | - | Custom exceeded handler |

### Sources

- [express-rate-limit GitHub](https://github.com/express-rate-limit/express-rate-limit)
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Rate Limiting in Express - Better Stack](https://betterstack.com/community/guides/scaling-nodejs/rate-limiting-express/)
- [MDN: Securing APIs with Express Rate Limit](https://developer.mozilla.org/en-US/blog/securing-apis-express-rate-limit-and-slow-down/)

---

## 3. VS Code Debug Configurations

### Do Starter Templates Include launch.json?

Yes, well-maintained Express + TypeScript starter templates include `.vscode/launch.json`. The [express-typescript-boilerplate](https://github.com/edwinhern/express-typescript) includes a `.vscode/` directory with editor settings.

### Recommended launch.json for RVETS Monorepo

```jsonc
{
  "version": "0.2.0",
  "configurations": [
    // ── Express Server (tsx) ──────────────────────────────
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/server/src/index.ts",
      "runtimeExecutable": "tsx",
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "skipFiles": [
        "<node_internals>/**",
        "${workspaceFolder}/node_modules/**"
      ],
      "env": {
        "NODE_ENV": "development"
      }
    },

    // ── Attach to Running Server ─────────────────────────
    {
      "name": "Attach to Server",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "skipFiles": [
        "<node_internals>/**",
        "${workspaceFolder}/node_modules/**"
      ],
      "restart": true
    },

    // ── Vite React Client (Chrome) ───────────────────────
    {
      "name": "Debug Client (Chrome)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5100",
      "webRoot": "${workspaceFolder}/client/src",
      "sourceMaps": true
    },

    // ── Vitest (Current File) ────────────────────────────
    {
      "name": "Debug Current Test",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/vitest",
      "args": ["run", "--reporter=verbose", "${relativeFile}"],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ],

  "compounds": [
    {
      "name": "Full Stack",
      "configurations": ["Debug Server", "Debug Client (Chrome)"]
    }
  ]
}
```

### Key Notes

1. **tsx runtime**: Use `"runtimeExecutable": "tsx"` to run TypeScript directly without a build step. This is the recommended approach from [tsx documentation](https://tsx.is/vscode).

2. **Attach mode**: For `--inspect` debugging, run the server with `tsx --inspect-brk ./server/src/index.ts` then use the "Attach" configuration.

3. **Vite client**: The Chrome debugger connects to the Vite dev server URL. Source maps work automatically with Vite. Adjust the port to match your Vite config (5100 per AppyStack convention).

4. **Compounds**: The "Full Stack" compound launches both server and client debuggers simultaneously.

### Additional VS Code Settings (.vscode/settings.json)

```jsonc
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Sources

- [tsx VS Code Debugging](https://tsx.is/vscode)
- [VS Code TypeScript Debugging](https://code.visualstudio.com/docs/typescript/typescript-debugging)
- [VS Code Node.js Debugging](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)
- [Vite Debugging Discussion](https://github.com/vitejs/vite/discussions/4065)

---

## 4. Peer Dependency Handling for Config Packages

### How Major Config Packages Handle This

#### @vercel/style-guide (v5)

All peer dependencies marked optional:

```json
{
  "peerDependencies": {
    "@next/eslint-plugin-next": ">=12.3.0 <15.0.0-0",
    "eslint": ">=8.48.0 <9",
    "prettier": ">=3.0.0 <4",
    "typescript": ">=4.8.0 <6"
  },
  "peerDependenciesMeta": {
    "@next/eslint-plugin-next": { "optional": true },
    "eslint": { "optional": true },
    "prettier": { "optional": true },
    "typescript": { "optional": true }
  }
}
```

This means npm will not auto-install or warn about missing peers unless the consumer explicitly uses those features.

#### eslint-config-airbnb

Uses required peer dependencies with a helper install command:

```bash
npx install-peerdeps --dev eslint-config-airbnb
```

This queries the package's peer dependencies and installs them all. Not great DX (extra tool, confusing for beginners).

### Recommendation for @appydave/appystack-config

**Strategy: Required peers for core tools, optional for extras.**

```json
{
  "peerDependencies": {
    "eslint": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "^5.0.0",
    "vitest": "^3.0.0",
    "@vitejs/plugin-react": "^4.0.0"
  },
  "peerDependenciesMeta": {
    "vitest": { "optional": true },
    "@vitejs/plugin-react": { "optional": true }
  }
}
```

**Rationale:**
- ESLint, Prettier, and TypeScript are **required** because every consumer needs them. npm 7+ auto-installs required peers.
- Vitest and React plugin are **optional** because server-only projects may not use them.
- Provide a **one-liner install command** in the README:

```bash
npm install --save-dev @appydave/appystack-config eslint prettier typescript
```

**DX improvements:**
- Include exact version ranges consumers should use
- Add a `postinstall` message or `npx appystack-config doctor` command that checks if required peers are installed
- Document in README which peer is needed for which config entry

### Sources

- [@vercel/style-guide package.json](https://github.com/vercel/style-guide/blob/canary/package.json)
- [eslint-config-airbnb README](https://github.com/airbnb/javascript/tree/master/packages/eslint-config-airbnb)
- [ESLint Shareable Configs docs](https://eslint.org/docs/latest/extend/shareable-configs)

---

## 5. Vitest Config in Shared Packages

### Can Config Packages Export Vitest Configs?

Yes, but the approach differs from ESLint/TypeScript configs. Vitest configs are JavaScript/TypeScript modules that export Vite config objects.

### Server (Node) vs Client (jsdom) Split

Vitest v3 supports **projects** (formerly workspaces) for running different environments:

```typescript
// vitest.config.ts (root)
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          include: ['server/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          include: ['client/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
        },
      },
    ],
  },
});
```

### Exportable Config Pattern for AppyStack

Rather than exporting a complete vitest config, export **config fragments** that consumers merge:

```typescript
// @appydave/appystack-config/vitest/server.ts
import { defineConfig, mergeConfig } from 'vitest/config';

export const serverTestConfig = {
  test: {
    environment: 'node' as const,
    include: ['**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'json-summary'],
    },
    globals: true,
  },
};

export default defineConfig({ test: serverTestConfig.test });
```

```typescript
// @appydave/appystack-config/vitest/client.ts
import { defineConfig } from 'vitest/config';

export const clientTestConfig = {
  test: {
    environment: 'jsdom' as const,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./test/setup.ts'],
    css: true,
    globals: true,
  },
};

export default defineConfig({ test: clientTestConfig.test });
```

**Consumer usage:**

```typescript
// packages/server/vitest.config.ts
import { defineConfig, mergeConfig } from 'vitest/config';
import serverConfig from '@appydave/appystack-config/vitest/server';

export default mergeConfig(serverConfig, defineConfig({
  test: {
    // project-specific overrides
  },
}));
```

### Important: resolve.conditions for jsdom

When running jsdom tests that import client-side code, set browser conditions to ensure proper module resolution:

```typescript
// client vitest config
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    conditions: ['browser'],
  },
});
```

Without this, jsdom tests may incorrectly resolve server-side package exports.

### Sources

- [Vitest Projects Guide](https://vitest.dev/guide/projects)
- [Vitest Environment Guide](https://vitest.dev/guide/environment)
- [Vitest Configuration Reference](https://vitest.dev/config/)
- [Vitest Monorepo Setup](https://www.thecandidstartup.org/2024/08/19/vitest-monorepo-setup.html)
- [Fixing jsdom resolve conditions](https://hy2k.dev/en/blog/2025/10-17-vitest-solid-browser-conditions/)

---

## 6. Template Customization Scripts

### How Popular Scaffolding Tools Work

#### create-vite
- Uses **prompts** (the npm package `prompts`) for interactive CLI
- Templates are static file trees that get copied
- Package name is replaced via string substitution in `package.json`
- Supports `--template` flag to skip prompts

#### create-t3-app
- Uses **@clack/prompts** (formerly used `inquirer`)
- Modular installer pattern: each feature (tRPC, Prisma, NextAuth) has its own installer module
- Conditional prompts (e.g., database provider only shown if Prisma selected)
- Centralized version management in `dependencyVersionMap.ts`

#### create-next-app
- Uses **prompts** npm package
- Copies from template directories
- Handles TypeScript/JavaScript variants via file extension swapping

### Recommended Library: @clack/prompts

**[@clack/prompts](https://www.clack.cc/)** (v1.0.0, February 2026) is the modern choice. It provides beautiful, accessible CLI prompts with minimal API surface. Used by create-t3-app and 3,800+ other packages.

```typescript
import * as p from '@clack/prompts';

async function main() {
  p.intro('Create RVETS App');

  const project = await p.group(
    {
      name: () =>
        p.text({
          message: 'Project name',
          placeholder: 'my-app',
          validate: (value) => {
            if (!value) return 'Project name is required';
            if (!/^[a-z0-9-]+$/.test(value)) return 'Use lowercase letters, numbers, and hyphens';
          },
        }),

      port: () =>
        p.text({
          message: 'Base port (client: PORT, server: PORT+1)',
          placeholder: '5100',
          initialValue: '5100',
          validate: (value) => {
            const n = parseInt(value, 10);
            if (isNaN(n) || n < 1024 || n > 65534) return 'Enter a valid port (1024-65534)';
          },
        }),

      features: () =>
        p.multiselect({
          message: 'Select features',
          initialValues: ['eslint', 'prettier', 'husky'],
          options: [
            { value: 'eslint', label: 'ESLint', hint: 'recommended' },
            { value: 'prettier', label: 'Prettier', hint: 'recommended' },
            { value: 'husky', label: 'Husky + lint-staged', hint: 'recommended' },
            { value: 'rate-limit', label: 'Rate limiting (express-rate-limit)' },
            { value: 'socket', label: 'Socket.io real-time support' },
            { value: 'vscode', label: '.vscode debug configs' },
          ],
        }),

      packageManager: () =>
        p.select({
          message: 'Package manager',
          initialValue: 'npm',
          options: [
            { value: 'npm', label: 'npm' },
            { value: 'pnpm', label: 'pnpm' },
            { value: 'yarn', label: 'yarn' },
          ],
        }),
    },
    {
      onCancel: () => {
        p.cancel('Setup cancelled.');
        process.exit(0);
      },
    }
  );

  const s = p.spinner();
  s.start('Scaffolding project...');

  // ... copy template, rename files, update ports
  await scaffoldProject(project);

  s.stop('Project created!');

  p.note(
    `cd ${project.name}\n${project.packageManager} install\n${project.packageManager} run dev`,
    'Next steps'
  );

  p.outro('Happy coding!');
}
```

### Scaffolding Implementation Pattern

Based on create-t3-app and create-vite patterns:

```typescript
import fs from 'node:fs';
import path from 'node:path';

interface ProjectConfig {
  name: string;
  port: string;
  features: string[];
  packageManager: string;
}

async function scaffoldProject(config: ProjectConfig) {
  const templateDir = path.resolve(__dirname, '../templates/default');
  const targetDir = path.resolve(process.cwd(), config.name);

  // 1. Copy template tree
  copyDir(templateDir, targetDir);

  // 2. Rename dotfiles (npm publish strips .gitignore)
  renameFile(targetDir, '_gitignore', '.gitignore');
  renameFile(targetDir, '_env.example', '.env.example');

  // 3. Update package.json
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  pkg.name = config.name;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // 4. Update ports in config files
  const clientPort = parseInt(config.port, 10);
  const serverPort = clientPort + 1;
  replaceInFile(
    path.join(targetDir, 'client/vite.config.ts'),
    '5100',
    String(clientPort)
  );
  replaceInFile(
    path.join(targetDir, 'server/src/index.ts'),
    '5101',
    String(serverPort)
  );

  // 5. Conditionally include feature files
  if (!config.features.includes('husky')) {
    fs.rmSync(path.join(targetDir, '.husky'), { recursive: true });
    // Remove lint-staged from package.json
  }
  if (!config.features.includes('vscode')) {
    fs.rmSync(path.join(targetDir, '.vscode'), { recursive: true });
  }
}

function renameFile(dir: string, from: string, to: string) {
  const src = path.join(dir, from);
  const dest = path.join(dir, to);
  if (fs.existsSync(src)) fs.renameSync(src, dest);
}
```

### Key Libraries for Building Scaffolding CLIs

| Library | Purpose | Used By |
|---------|---------|---------|
| [@clack/prompts](https://www.npmjs.com/package/@clack/prompts) | Beautiful interactive prompts | create-t3-app, SvelteKit |
| [prompts](https://www.npmjs.com/package/prompts) | Lightweight prompts | create-vite, create-next-app |
| [inquirer](https://www.npmjs.com/package/inquirer) | Full-featured prompts (heavier) | Yeoman, Angular CLI |
| [commander](https://www.npmjs.com/package/commander) | CLI argument parsing | Many CLIs |
| [chalk](https://www.npmjs.com/package/chalk) / [picocolors](https://www.npmjs.com/package/picocolors) | Terminal colors | Most CLIs (picocolors is smaller) |
| [execa](https://www.npmjs.com/package/execa) | Running shell commands | create-t3-app |

**Recommendation for AppyStack**: Use `@clack/prompts` + `commander` + `picocolors`. This is the modern, lightweight stack that provides great DX with minimal dependencies.

### Sources

- [@clack/prompts](https://www.clack.cc/)
- [create-t3-app CLI source](https://github.com/t3-oss/create-t3-app/tree/main/cli)
- [create-vite source](https://github.com/vitejs/vite/tree/main/packages/create-vite)
- [Building an npm create package](https://www.alexchantastic.com/building-an-npm-create-package)

---

## Summary: Recommendations for AppyStack

| Area | Recommendation | Confidence |
|------|---------------|------------|
| Git hooks | Husky v9 + lint-staged | High - industry standard |
| Rate limiting | Include express-rate-limit with sensible defaults | High - security baseline |
| VS Code configs | Ship `.vscode/launch.json` + `settings.json` | High - major DX win |
| Peer dependencies | Required for core (eslint/prettier/ts), optional for extras | High - follows Vercel pattern |
| Vitest configs | Export config fragments, use projects for node/jsdom split | Medium - pattern is emerging |
| Scaffolding CLI | @clack/prompts + commander for `create-rvets-app` | High - modern standard |
