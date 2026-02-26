# @flivideo/config

Shared configuration for **FliStack** - the FliVideo technology stack.

## What is FliStack?

FliStack is the standardized technology stack used across all FliVideo projects:

- **RVETS Core**: React, Vite, Express, TypeScript, Socket.io
- **Quality Tools**: Vitest, ESLint, Prettier, Zod, Pino

This package provides shared, battle-tested configurations for all quality tooling.

## Installation

```bash
npm install --save-dev @flivideo/config
```

## Usage

### ESLint

**For non-React projects (Node/server):**

```javascript
// eslint.config.js
import fliConfig from '@flivideo/config/eslint/base';

export default [
  ...fliConfig,
  // Add your custom rules here
];
```

**For React projects:**

```javascript
// eslint.config.js
import fliConfig from '@flivideo/config/eslint/react';

export default [
  ...fliConfig,
  // Add your custom rules here
];
```

### Vitest

**For server/Node projects:**

```typescript
// vitest.config.ts
import { mergeConfig, defineConfig } from 'vitest/config';
import fliConfig from '@flivideo/config/vitest/server';

export default mergeConfig(
  fliConfig,
  defineConfig({
    // Your custom config here
  })
);
```

### TypeScript

**For React projects:**

```json
{
  "extends": "@flivideo/config/typescript/react",
  "compilerOptions": {
    // Your overrides here
  },
  "include": ["src"]
}
```

**For Node/server projects:**

```json
{
  "extends": "@flivideo/config/typescript/node",
  "compilerOptions": {
    // Your overrides here
  }
}
```

**Base config (for custom setups):**

```json
{
  "extends": "@flivideo/config/typescript/base",
  "compilerOptions": {
    // Your custom config here
  }
}
```

### Prettier

**Option 1: Extend in package.json**

```json
{
  "prettier": "@flivideo/config/prettier"
}
```

**Option 2: Extend in .prettierrc**

```json
"@flivideo/config/prettier"
```

**Option 3: Copy the .prettierignore**

```bash
cp node_modules/@flivideo/config/prettier/.prettierignore .prettierignore
```

## FliStack Philosophy

### Technology Choices

- **React**: Industry-standard UI framework with massive ecosystem
- **Vite**: Lightning-fast dev server and build tool
- **Express**: Battle-tested Node.js server framework
- **TypeScript**: Type safety across the entire stack
- **Socket.io**: Real-time bidirectional communication
- **Vitest**: Fast, modern test runner with great DX
- **ESLint**: Code quality and consistency
- **Prettier**: Automated code formatting
- **Zod**: Runtime type validation
- **Pino**: High-performance logging

### Why Share Configurations?

1. **Consistency**: All FliVideo apps follow the same standards
2. **Maintainability**: Update configs once, benefit everywhere
3. **Onboarding**: New developers know the stack instantly
4. **Best Practices**: Battle-tested configs from real projects
5. **Time Savings**: No bikeshedding over formatting rules

## Apps Using FliStack

- **FliGen**: CLI generator for FliVideo projects
- **Storyline App**: Video content planning and review
- **FliVideo Core**: Video asset management (planned)
- **Agent Workflow Builder**: Multi-agent orchestration (planned)

## Contributing

Found a configuration issue? Open an issue or PR in the FliVideo monorepo.

## License

MIT
