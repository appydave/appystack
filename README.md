# AppyStack

**Production-ready full-stack architecture for modern web applications**

## What is AppyStack?

AppyStack is a proven, production-ready technology stack combining the best modern tools for building full-stack web applications with real-time capabilities.

### The RVETS Stack

**Core Technologies:**
- **R**eact 19 - UI framework
- **V**ite 6 - Build tool & dev server
- **E**xpress 5 - Backend server
- **T**ypeScript 5.7+ - Type system
- **S**ocket.io 4.8 - Real-time communication

**Quality Layer:**
- **Vitest** - Testing framework
- **ESLint 9** - Code linting (flat config)
- **Prettier** - Code formatting
- **Zod** - Runtime validation
- **Pino** - Structured logging

**Architecture:**
- **npm workspaces** - Monorepo structure
- **Client/Server/Shared** - Workspace organization

---

## Quick Start

### Jump Alias
```bash
japp-stack  # Jump to this directory
```

### Using the Shared Config Package

The `config/` folder contains reusable configurations for all AppyStack projects.

**Installation:**
```bash
npm install --save-dev file:../../apps/appystack/config
```

**Or from anywhere:**
```bash
npm install --save-dev file:/Users/davidcruwys/dev/ad/apps/appystack/config
```

---

## Folder Structure

```
appystack/
├── README.md              # This file
├── config/                # Shared configuration package
│   ├── eslint/           # ESLint configs (base + react)
│   ├── vitest/           # Vitest configs (client + server)
│   ├── typescript/       # TypeScript configs (base, react, node)
│   └── prettier/         # Prettier configs
└── docs/                 # Documentation
    └── planning/         # All planning and implementation docs
```

---

## Documentation

All planning and implementation documentation is in `docs/planning/`:

### Architecture & Standards
- `flivideo-standard-architecture-v1.0.md` - Complete architecture reference
- `external-repos-analysis.md` - Analysis of 5 popular starter templates
- `architecture-alignment-report.md` - Cross-project architecture alignment

### Implementation Guides
- `fligen-quick-wins-complete.md` - Complete implementation guide
- `quality-tooling-fixes-post-mortem.md` - What broke and how it was fixed
- `quick-wins-verification-checklist.md` - Verification procedures
- `replication-briefs-for-remaining-apps.md` - How to replicate to new apps

### Progress Tracking
- `four-apps-progress-review-2026-02-14.md` - Final status of all 4 apps
- `dependency-updates-2026-02-10.md` - Dependency alignment work

### Workflows
- `po-dev-workflow.md` - Product Owner ↔ Developer workflow

---

## Proven in Production

AppyStack has been successfully implemented in 4 production applications:

1. **FliGen** - 12 Days of Claudemas harness
2. **FliHub** - Video recording workflows
3. **FliDeck** - Presentation viewer
4. **Storyline App** - Video content planning

All 4 apps have:
- ✅ Automated testing
- ✅ Code quality enforcement
- ✅ CI/CD pipelines
- ✅ Type-safe configuration
- ✅ Structured logging
- ✅ Consistent architecture

---

## Using AppyStack Configs

### ESLint (eslint.config.js)
```javascript
// For React apps
import appyConfig from '@appystack/config/eslint/react';
export default [...appyConfig];

// For Node apps
import appyConfig from '@appystack/config/eslint/base';
export default [...appyConfig];
```

### TypeScript (tsconfig.json)
```json
{
  "extends": "@appystack/config/typescript/react"
}
```

### Prettier (package.json)
```json
{
  "prettier": "@appystack/config/prettier"
}
```

### Vitest (vitest.config.ts)
```typescript
import { mergeConfig } from 'vitest/config';
import appyConfig from '@appystack/config/vitest/server';

export default mergeConfig(appyConfig, defineConfig({
  // Your custom config
}));
```

---

## Next Steps

1. **Review documentation** in `docs/planning/`
2. **Explore the config package** in `config/`
3. **Create a new project** using AppyStack configs
4. **Share and iterate** - improve the stack over time

---

## The AppyStack Philosophy

**Production-Ready from Day One**
- Don't bolt on quality tooling later - start with it
- Catch bugs early with automated testing
- Enforce standards with linting and formatting
- Deploy with confidence using CI/CD

**Consistency Across Projects**
- Same architecture, same patterns
- Easy to maintain multiple projects
- Knowledge transfers between projects
- Onboard developers faster

**Modern & Proven**
- React 19 for cutting-edge UI
- Vite 6 for lightning-fast builds
- TypeScript 5.7+ for type safety
- Socket.io for real-time features
- Vitest for fast testing

---

**Location:** `/Users/davidcruwys/dev/ad/apps/appystack`
**Jump Alias:** `japp-stack`
**Last Updated:** 2026-02-14
