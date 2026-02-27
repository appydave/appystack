# Extending Configs

> How to add project-specific rules and options on top of the shared AppyStack configs without modifying the config package itself.

## The Inheritance Chain

AppyStack configs are layered. Each layer adds to the previous without repeating shared logic.

**TypeScript:**

```
config/typescript/base.json     ← strict ES2022 baseline (all targets)
       ├── react.json           ← extends base + DOM libs + JSX + noEmit
       └── node.json            ← extends base + outDir/rootDir for compilation
```

**ESLint:**

```
config/eslint/base.config.js    ← TypeScript + JS rules (server/Node projects)
config/eslint/react.config.js   ← base rules + react + react-hooks rules (client)
```

`react.config.js` is self-contained — it duplicates the base block and adds a second React-specific block. ESLint 9 flat config has no native array-extends mechanism, so the full ruleset is exported. A React project gets both TypeScript and React linting from a single import.

The chain keeps configs purposeful: server packages import `base.config.js` and `node.json`; client packages import `react.config.js` and `react.json`. A shared types-only package needs only `base.json`.

---

## Adding Custom ESLint Rules

Import the config array, spread it, and append your overrides. ESLint 9 flat config resolves rules in array order — later entries win.

```javascript
// your-project/eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/react';

export default [
  ...appyConfig,

  // Project-specific additions — always at the end
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error', // tighten from 'warn'
      'no-restricted-imports': ['error', { patterns: ['../**/server/*'] }],
    },
  },

  // Scope a rule to specific files
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
```

For a server-only project swap the import:

```javascript
// your-project/server/eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/base';

export default [
  ...appyConfig,
  {
    rules: {
      'no-console': 'warn', // override the base 'off' setting
    },
  },
];
```

Never edit `config/eslint/base.config.js` or `config/eslint/react.config.js` directly for project-specific rules — changes to the config package affect all consumers.

---

## Extending TypeScript Options

Extend the shared base and add only what is unique to the project.

**React client — adding path aliases:**

```json
{
  "extends": "@appydave/appystack-config/typescript/react",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"]
    }
  },
  "include": ["src"]
}
```

All `strict`, JSX, DOM lib, and `noEmit` settings are inherited from `react.json`.

**Node server — overriding output directories:**

```json
{
  "extends": "@appydave/appystack-config/typescript/node",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@config/*": ["src/config/*"],
      "@routes/*": ["src/routes/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

Note: if you use path aliases in a compiled (non-bundled) Node project, run `tsc-alias` after `tsc` to rewrite aliases in the output.

TypeScript `lib` arrays replace rather than merge — when overriding `lib`, repeat the inherited values:

```json
{
  "extends": "@appydave/appystack-config/typescript/react",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"]
  }
}
```

---

## Adding a Custom Vitest Setup File

Use `mergeConfig` from `vitest/config` to layer project options on top of the shared config.

```typescript
// your-project/server/vitest.config.ts
import { mergeConfig } from 'vitest/config';
import baseConfig from '@appydave/appystack-config/vitest/server';

export default mergeConfig(baseConfig, {
  test: {
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/test/**', 'src/**/*.test.ts'],
    },
  },
});
```

`mergeConfig` deep-merges — your `test` properties are added to the base rather than replacing the whole object. The base already provides `environment: 'node'`, `globals: true`, `testTimeout: 10000`, and `hookTimeout: 10000`.

For client tests that need jsdom, override the environment:

```typescript
// your-project/client/vitest.config.ts
import { mergeConfig } from 'vitest/config';
import baseConfig from '@appydave/appystack-config/vitest/server';

export default mergeConfig(baseConfig, {
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

---

## Overriding Prettier Settings

Reference the shared config in `package.json` to use it as-is:

```json
{
  "prettier": "@appydave/appystack-config/prettier"
}
```

The shared config provides: `singleQuote: true`, `semi: true`, `tabWidth: 2`, `trailingComma: "es5"`, `printWidth: 100`, `arrowParens: "always"`.

Prettier does not support config inheritance. To override individual settings, create a `.prettierrc` at the project root — it takes precedence over the `package.json` key. Repeat the shared values you want to keep:

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 120,
  "arrowParens": "always"
}
```

---

## When to Fork vs Extend

**Extend** whenever you are adding rules, tightening existing rules, or scoping rules to file patterns. This keeps the project in sync with future config package updates.

| Goal | Approach |
|------|----------|
| Add a new rule | Extend — append to the array |
| Change `'warn'` to `'error'` | Extend — override the specific rule |
| Silence a rule | Extend — set rule to `'off'` |
| Apply a rule only in tests | Extend — add a `files`-scoped block |
| Remove a plugin entirely | Fork |

**Fork** only when you need to remove an inherited plugin or rule set entirely — not just silence it. Setting a rule to `'off'` in an extending config is functionally equivalent to removing it (no output, no overhead worth worrying about). Forking severs the update chain: every future change to the shared config must be manually applied to each fork.

---

## Reference

| File | Purpose |
|------|---------|
| `config/eslint/base.config.js` | TypeScript + JS rules for server/Node |
| `config/eslint/react.config.js` | Base rules + React + hooks rules for client |
| `config/typescript/base.json` | Strict ES2022 baseline for all targets |
| `config/typescript/react.json` | Extends base — DOM, JSX, noEmit |
| `config/typescript/node.json` | Extends base — outDir, rootDir, include/exclude |
| `config/vitest/server.config.ts` | Node environment, globals, 10 s timeouts |
| `config/prettier/.prettierrc` | Single quotes, semi, 100 width, es5 trailing commas |
