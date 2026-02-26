# FliVideo Standard Architecture v1.0

**Status**: Implemented across all projects
**Date**: 2026-02-11
**Last Updated**: 2026-02-14
**Purpose**: Canonical reference architecture for all FliVideo projects
**Approach**: Union of all features from FliDeck, FliGen, FliHub, and Storyline App

---

## Overview

This document defines the **standard architecture** for FliVideo family projects. It represents the **aspirational state** - the union of all patterns, features, and best practices currently implemented across the 4 production projects.

**What this is:**
- Source of truth for new projects
- **IMPLEMENTED** state for existing projects (as of Feb 2026)
- Reference for architectural decisions
- Template extraction specification

**What this is NOT:**
- A requirement that all projects must have all features
- A one-size-fits-all solution (see selection guide)
- Immutable (will evolve based on learnings)

**Implementation Status (Feb 2026):**
- ✅ Core architecture implemented in all 4 apps
- ✅ Quality tooling (testing, linting, CI) implemented in all 4 apps
- ✅ Environment validation and logging implemented in all 4 apps
- 🔄 Advanced features (feature-based architecture, shared configs) in planning

---

## 1. Core Architecture

### 1.1 Monorepo Structure

**Pattern**: npm workspaces with three-package structure

```
project-root/
├── package.json                    # Root workspace configuration
├── .gitignore                      # Git ignore patterns
├── .env.example                    # Environment template
├── CLAUDE.md                       # Project documentation for AI
├── README.md                       # Project overview
├── client/                         # React frontend
│   ├── package.json                # Client dependencies
│   ├── tsconfig.json               # TypeScript config
│   ├── vite.config.ts              # Vite build config
│   ├── index.html                  # Entry point
│   └── src/
│       ├── main.tsx                # React entry
│       ├── App.tsx                 # Root component
│       ├── components/             # React components
│       ├── pages/                  # Route pages
│       ├── hooks/                  # Custom hooks
│       ├── contexts/               # React contexts
│       ├── utils/                  # Utilities
│       └── styles/                 # Global styles
├── server/                         # Express backend
│   ├── package.json                # Server dependencies
│   ├── tsconfig.json               # TypeScript config
│   └── src/
│       ├── index.ts                # Server entry point
│       ├── routes/                 # API routes
│       ├── services/               # Business logic
│       ├── middleware/             # Express middleware
│       ├── utils/                  # Utilities
│       └── types/                  # Server-specific types
└── shared/                         # Shared TypeScript types
    ├── package.json                # Shared package config
    ├── tsconfig.json               # TypeScript config
    └── src/
        └── types.ts                # Shared types/interfaces
```

### 1.2 Package Naming Convention

**Standard**: Scoped package names with `@projectname/workspace` pattern

```json
{
  "name": "@projectname/client",
  "name": "@projectname/server",
  "name": "@projectname/shared"
}
```

**Examples**:
- `@flideck/client`, `@flideck/server`, `@flideck/shared`
- `@fligen/client`, `@fligen/server`, `@fligen/shared`
- `@flihub/client`, `@flihub/server`, `@flihub/shared`
- `@storyline/client`, `@storyline/server`, `@storyline/shared`

### 1.3 Port Allocation

**Pattern**: 5X00 range for client, 5X01 range for server

| Project | Client Port | Server Port | Range |
|---------|------------|------------|-------|
| FliDeck | 5200 | 5201 | 520x |
| FliGen | 5400 | 5401 | 540x |
| FliHub | Vite default | 5101 | 510x |
| Storyline App | 5300 | 5301 | 530x |
| **Available** | 5500 | 5501 | 550x |
| **Available** | 5600 | 5601 | 560x |

**Rule**: Allocate ports in 100s to avoid conflicts across projects.

---

## 2. Technology Stack

### 2.1 Core Stack (Required)

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend Framework** | React | ^19.1.0 | UI library |
| **Build Tool** | Vite | ^6.0.6 | Fast dev server & bundler |
| **Styling** | TailwindCSS | ^4.1.13 | Utility-first CSS |
| **Backend Framework** | Express | ^5.1.0 | HTTP server |
| **Real-time** | Socket.io | ^4.8.1 | WebSocket communication |
| **Language** | TypeScript | ^5.7.2 | Type safety |
| **Runtime** | Node.js | >=20.0.0 | JavaScript runtime |

### 2.2 State Management (Optional)

| Library | Version | Use Case |
|---------|---------|----------|
| **TanStack Query** | ^5.87.1 | Server state, caching |
| **React Context** | Built-in | Global app state |
| **Socket.io** | ^4.8.1 | Real-time state |

### 2.3 Routing (Optional)

| Library | Version | Use Case |
|---------|---------|----------|
| **React Router** | ^7.8.2 | Client-side routing |

### 2.4 UI Libraries (Optional)

| Library | Version | Purpose |
|---------|---------|---------|
| **Sonner** | ^1.7.1 | Toast notifications |
| **Monaco Editor** | ^4.7.0 | Code editing |
| **Sharp** | ^0.34.4 | Image processing |

### 2.5 Middleware & Security (Required for Production)

| Library | Version | Purpose |
|---------|---------|---------|
| **Helmet** | ^8.0.0 | Security headers |
| **Compression** | ^1.7.5 | Gzip compression |
| **CORS** | ^2.8.5 | Cross-origin requests |
| **Morgan** | ^1.10.0 | HTTP request logging |

### 2.6 File System (Optional)

| Library | Version | Purpose |
|---------|---------|---------|
| **Chokidar** | ^3.6.0 | File watching |
| **fs-extra** | ^11.3.0 | File system utilities |

### 2.7 Development Tools (Required)

| Tool | Version | Purpose |
|------|---------|---------|
| **tsx** | ^4.19.2 | TypeScript execution |
| **nodemon** | ^3.1.9 | Auto-restart server |
| **concurrently** | ^9.1.0 | Run multiple commands |

---

## 3. Standard Dependencies

### 3.1 Root Package.json

```json
{
  "name": "@projectname/root",
  "private": true,
  "type": "module",
  "workspaces": [
    "client",
    "server",
    "shared"
  ],
  "scripts": {
    "dev": "concurrently -n server,client -c blue,green \"npm run dev -w server\" \"npm run dev -w client\"",
    "build": "npm run build -w server && npm run build -w client",
    "start": "npm start -w server",
    "lint": "npm run lint -w client && npm run lint -w server",
    "clean": "rm -rf client/dist server/dist node_modules */node_modules"
  },
  "devDependencies": {
    "concurrently": "^9.1.0"
  },
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=10.0.0"
  }
}
```

### 3.2 Client Package.json

```json
{
  "name": "@projectname/client",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "socket.io-client": "^4.8.1",
    "@tanstack/react-query": "^5.87.1",
    "react-router-dom": "^7.8.2",
    "sonner": "^1.7.1"
  },
  "devDependencies": {
    "@types/react": "^19.1.10",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.1.13",
    "@tailwindcss/vite": "^4.1.13",
    "typescript": "^5.7.2",
    "vite": "^6.0.6"
  }
}
```

### 3.3 Server Package.json

```json
{
  "name": "@projectname/server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint . --ext ts"
  },
  "dependencies": {
    "@projectname/shared": "*",
    "express": "^5.1.0",
    "socket.io": "^4.8.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "chokidar": "^3.6.0",
    "fs-extra": "^11.3.0",
    "helmet": "^8.0.0",
    "compression": "^1.7.5",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/cors": "^2.8.17",
    "@types/node": "^22.10.2",
    "@types/compression": "^1.7.5",
    "@types/morgan": "^1.9.9",
    "tsx": "^4.19.2",
    "nodemon": "^3.1.9",
    "typescript": "^5.7.2"
  }
}
```

### 3.4 Shared Package.json

```json
{
  "name": "@projectname/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "./src/types.ts",
  "types": "./src/types.ts",
  "scripts": {
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7.2"
  }
}
```

---

## 4. TypeScript Configuration

### 4.1 Client tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedSideEffectImports": true
  },
  "include": ["src"]
}
```

### 4.2 Server tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 4.3 Shared tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 5. Build & Development

### 5.1 Vite Configuration

**File**: `client/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5200, // Change per project
    proxy: {
      '/api': {
        target: 'http://localhost:5201', // Change per project
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:5201',
        ws: true,
      },
    },
  },
});
```

### 5.2 TailwindCSS v4

**File**: `client/src/styles/index.css`

```css
@import "tailwindcss";
@source "./**/*.{js,ts,jsx,tsx}";

/* Optional: Safelist classes for conditionally rendered components */
@source inline("m-auto w-96 p-0 backdrop:bg-black/50");
```

**Critical Notes**:
- Use `@import "tailwindcss"` (NOT `@tailwind` directives from v3)
- Use `@source` with recursive glob `"./**/*.{js,ts,jsx,tsx}"`
- Safelist modal/dropdown classes that may not be detected

### 5.3 Environment Variables

**File**: `.env.example`

```env
# Server Configuration
PORT=5201
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:5200

# Optional: External APIs
API_KEY=your-api-key-here
```

**Usage**:
```typescript
import 'dotenv/config';

const PORT = process.env.PORT || 5201;
```

---

## 6. Real-time Architecture

### 6.1 Socket.io Pattern

**Server Setup** (`server/src/index.ts`):

```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5200',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join:room', (roomId: string) => {
    socket.join(roomId);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emit events from services
export { io };
```

**Client Hook** (`client/src/hooks/useSocket.ts`):

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5201';

export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socketInstance = io(SERVER_URL);

    socketInstance.on('connect', () => {
      setConnected(true);
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.close();
    };
  }, []);

  return { socket, connected };
}
```

### 6.2 File Watching (Optional)

**Server Pattern** (`server/src/services/WatcherService.ts`):

```typescript
import chokidar from 'chokidar';
import { io } from '../index.js';

export class WatcherService {
  private watcher: chokidar.FSWatcher;

  constructor(private path: string) {
    this.watcher = chokidar.watch(path, {
      ignoreInitial: true,
      awaitWriteFinish: true,
    });

    this.setupListeners();
  }

  private setupListeners() {
    this.watcher.on('add', (path) => {
      io.emit('file:added', { path });
    });

    this.watcher.on('change', (path) => {
      io.emit('file:changed', { path });
    });

    this.watcher.on('unlink', (path) => {
      io.emit('file:deleted', { path });
    });
  }

  close() {
    this.watcher.close();
  }
}
```

---

## 7. API Patterns

### 7.1 Express Server Setup

**File**: `server/src/index.ts`

```typescript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import 'dotenv/config';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use(morgan('dev'));

// Routes
import { router as apiRouter } from './routes/index.js';
app.use('/api', apiRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5201;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### 7.2 Route Pattern

**File**: `server/src/routes/index.ts`

```typescript
import { Router } from 'express';

export const router = Router();

router.get('/items', async (req, res) => {
  try {
    const items = await getItems();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

router.post('/items', async (req, res) => {
  try {
    const item = await createItem(req.body);
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create item' });
  }
});
```

### 7.3 Service Pattern

**File**: `server/src/services/ItemService.ts`

```typescript
export class ItemService {
  async getAll() {
    // Business logic
    return [];
  }

  async create(data: any) {
    // Business logic
    return data;
  }
}

export const itemService = new ItemService();
```

---

## 8. Frontend Patterns

### 8.1 Component Structure

```
client/src/components/
├── Layout/
│   ├── Header.tsx
│   ├── Footer.tsx
│   └── Sidebar.tsx
├── Common/
│   ├── Button.tsx
│   ├── Modal.tsx
│   └── Loading.tsx
└── Feature/
    ├── FeatureList.tsx
    ├── FeatureDetail.tsx
    └── FeatureForm.tsx
```

### 8.2 Custom Hooks

```
client/src/hooks/
├── useSocket.ts              # Socket.io connection
├── useData.ts                # TanStack Query wrapper
├── useDebounce.ts            # Debounced values
└── useLocalStorage.ts        # Persistent state
```

### 8.3 React Query Pattern

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useItems() {
  return useQuery({
    queryKey: ['items'],
    queryFn: async () => {
      const res = await fetch('/api/items');
      return res.json();
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
}
```

---

## 9. Configuration Management

### 9.1 External Config File (Optional)

**Pattern**: JSON config file with hot-reload support

**File**: `config.json` (gitignored)

```json
{
  "rootPath": "~/path/to/data",
  "history": ["~/previous/path1", "~/previous/path2"]
}
```

**File**: `config.example.json` (committed)

```json
{
  "rootPath": "~/default/path",
  "history": []
}
```

**Server Pattern** (`server/src/services/ConfigService.ts`):

```typescript
import fs from 'fs';
import chokidar from 'chokidar';
import { io } from '../index.js';

export class ConfigService {
  private config: any;
  private watcher: chokidar.FSWatcher;

  constructor(private configPath: string) {
    this.loadConfig();
    this.watchConfig();
  }

  private loadConfig() {
    const data = fs.readFileSync(this.configPath, 'utf-8');
    this.config = JSON.parse(data);
  }

  private watchConfig() {
    this.watcher = chokidar.watch(this.configPath);
    this.watcher.on('change', () => {
      this.loadConfig();
      io.emit('config:changed', this.config);
    });
  }

  get() {
    return this.config;
  }
}
```

---

## 10. Git & Security

### 10.1 .gitignore

```gitignore
# Dependencies
node_modules/
package-lock.json

# Build output
dist/
build/

# Environment
.env
.env.local

# Config
config.json

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
```

### 10.2 Git Hooks (Gitleaks)

**File**: `.git/hooks/pre-commit`

```bash
#!/bin/bash
# Prevent committing secrets

if ! command -v gitleaks &> /dev/null; then
  echo "⚠️  gitleaks not found. Install: brew install gitleaks"
  exit 1
fi

echo "Running gitleaks to check for secrets..."
gitleaks protect --staged --verbose

if [ $? -ne 0 ]; then
  echo "❌ Secrets detected! Commit blocked."
  exit 1
fi

echo "✅ No secrets detected. Proceeding with commit..."
```

**File**: `.gitleaksignore`

```
# Format: <rule-id>:<file>:<line>
generic-api-key:config/example.json:10
```

---

## 11. Documentation Standards

### 11.1 CLAUDE.md Structure

```markdown
# CLAUDE.md

## Quick Reference
- Commands, scripts, common tasks

## Project Overview
- Purpose, tech stack, architecture

## Commands
- npm scripts and usage

## Architecture
- Folder structure, patterns, conventions

## Documentation
- Links to detailed docs

## Current Status
- What's implemented, what's next

## Slash Commands
- Custom agent commands

## Critical Notes
- Gotchas, workarounds, important patterns

## Related Projects
- Dependencies, related systems
```

### 11.2 README.md Structure

```markdown
# Project Name

Brief description

## Features
- Feature list

## Tech Stack
- Technologies used

## Getting Started
- Prerequisites
- Installation
- Running the app

## Project Structure
- Folder overview

## Scripts
- npm script descriptions

## Contributing
- Guidelines (if open source)

## License
```

---

## 12. Testing (✅ Implemented as of Feb 2026)

### 12.1 Frontend Testing

**Tools**: Vitest + Testing Library
**Status**: Implemented in all 4 apps (FliGen, FliHub, FliDeck, Storyline App)

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.0.0"
  },
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui"
  }
}
```

### 12.2 Backend Testing

**Tools**: Vitest + Supertest
**Status**: Implemented in all 4 apps (FliGen, FliHub, FliDeck, Storyline App)

```json
{
  "devDependencies": {
    "vitest": "^2.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

---

## 13. CI/CD (✅ Implemented as of Feb 2026)

### 13.1 GitHub Actions

**Status**: Implemented in all 4 apps with lint, typecheck, and test jobs

**File**: `.github/workflows/ci.yml`

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npm run lint
      - run: npm run build
      - run: npm test
```

---

## 14. When to Use This Architecture

### ✅ Use FliVideo Standard Architecture When:

- Building production applications
- Need real-time features (Socket.io)
- Multiple workspaces (client/server/shared)
- Team collaboration expected
- Long-term maintenance planned
- Need structured, scalable architecture

### ❌ DON'T Use This Architecture When:

- Building demos or prototypes (use simpler templates)
- External SDK expects specific architecture (follow SDK patterns)
- Time-constrained (<2 days)
- Learning experiment
- Single-page static tool
- Project doesn't need a server

### 📊 Complexity Levels

```
Level 1: Single HTML file (0-100 lines)
  → Use for: Demos, SDK testing, quick prototypes

Level 2: Vite + React only (no server, no workspaces)
  → Use for: Static apps, client-only tools

Level 3: FliVideo Standard Architecture (this document)
  → Use for: Production apps with real-time features
```

---

## 15. Version History

### v1.0 (2026-02-11)

**Initial baseline** - Union of patterns from:
- FliDeck (presentation viewer)
- FliGen (tool builder)
- FliHub (video workflows)
- Storyline App (content planning)

**What's included**:
- ✅ Monorepo structure (npm workspaces)
- ✅ Core tech stack (React 19, Vite 6, Express 5, Socket.io)
- ✅ Standard dependencies and versions
- ✅ TypeScript configurations
- ✅ Real-time architecture patterns
- ✅ Configuration management
- ✅ Security middleware
- ✅ Git hooks (gitleaks)
- ✅ Documentation standards

**What's implemented** (as of Feb 2026):
- ✅ Testing setup (Vitest) - All 4 apps
- ✅ CI/CD (GitHub Actions) - All 4 apps
- ✅ Zod environment validation - All 4 apps
- ✅ Pino structured logging - All 4 apps
- ✅ ESLint 9 + Prettier - All 4 apps

**What's still aspirational**:
- ⚠️ Consistent security middleware across all projects
- ⚠️ Scoped package names in all projects
- ⚠️ Feature-based architecture refactoring
- ⚠️ Shared configuration packages

---

## 16. Next Steps

1. ✅ **Use as reference** for new projects - COMPLETE
2. ✅ **Compare external repos** to this baseline - COMPLETE (see external-repos-analysis.md)
3. ✅ **Implement quality tooling** in all existing projects - COMPLETE (Feb 2026)
4. 🔄 **Extract to template** for easy project generation - IN PLANNING
5. 🔄 **Implement advanced features** (feature-based architecture, shared configs)
6. 🔄 **Evolve to v2.0** based on learnings

---

**Document Status**: Living document - will evolve based on learnings
**Review Cadence**: Quarterly (next review: 2026-05-11)
**Owner**: David Cruwys / FliVideo Team
**Last Updated**: 2026-02-14
