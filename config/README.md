# @appydave/appystack-config

Shared ESLint, TypeScript, Vitest, and Prettier configurations for the AppyStack RVETS stack (React, Vite, Express, TypeScript, Socket.io).

## Installation

```bash
npm install --save-dev @appydave/appystack-config
```

## Usage

### ESLint

**For Node/server projects:**

```javascript
// eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/base';

export default [
  ...appyConfig,
  // Add your custom rules here
];
```

**For React projects:**

```javascript
// eslint.config.js
import appyConfig from '@appydave/appystack-config/eslint/react';

export default [
  ...appyConfig,
  // Add your custom rules here
];
```

### Vitest

**For server/Node projects:**

```typescript
// vitest.config.ts
import { mergeConfig, defineConfig } from 'vitest/config';
import appyConfig from '@appydave/appystack-config/vitest/server';

export default mergeConfig(
  appyConfig,
  defineConfig({
    // Your custom config here
  })
);
```

**For client/React projects (jsdom environment):**

```typescript
// vitest.config.ts
import { mergeConfig, defineConfig } from 'vitest/config';
import appyConfig from '@appydave/appystack-config/vitest/client';

export default mergeConfig(
  appyConfig,
  defineConfig({
    // Your custom config here
  })
);
```

### TypeScript

**For React projects:**

```json
{
  "extends": "@appydave/appystack-config/typescript/react",
  "compilerOptions": {
    // Your overrides here
  },
  "include": ["src"]
}
```

**For Node/server projects:**

```json
{
  "extends": "@appydave/appystack-config/typescript/node",
  "compilerOptions": {
    // Your overrides here
  }
}
```

**Base config (for custom setups):**

```json
{
  "extends": "@appydave/appystack-config/typescript/base",
  "compilerOptions": {
    // Your custom config here
  }
}
```

### Prettier

**Option 1: Reference in package.json**

```json
{
  "prettier": "@appydave/appystack-config/prettier"
}
```

**Option 2: Reference in .prettierrc**

```json
"@appydave/appystack-config/prettier"
```

**Option 3: Copy the .prettierignore**

```bash
cp node_modules/@appydave/appystack-config/prettier/.prettierignore .prettierignore
```

## Philosophy

### Why Share Configurations?

1. **Consistency**: All AppyStack apps follow the same standards
2. **Maintainability**: Update configs once, benefit everywhere
3. **Onboarding**: New developers know the stack instantly
4. **Best Practices**: Battle-tested configs from real projects
5. **Time Savings**: No bikeshedding over formatting rules

### Technology Choices

- **React**: Industry-standard UI framework with massive ecosystem
- **Vite**: Lightning-fast dev server and build tool
- **Express**: Battle-tested Node.js server framework
- **TypeScript**: Type safety across the entire stack
- **Socket.io**: Real-time bidirectional communication
- **Vitest**: Fast, modern test runner with great DX
- **ESLint 9**: Flat config for code quality and consistency
- **Prettier**: Automated code formatting

## Apps Using AppyStack

- **FliHub**: Video asset management hub
- **FliDeck**: Video production dashboard
- **Storyline App**: Video content planning and review
- **Agent Workflow Builder**: Multi-agent orchestration (planned)

## License

MIT
