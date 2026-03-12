import { describe, it, expect } from 'vitest';
import { classifyFile } from '../bin/lib/classify.js';

// ---------------------------------------------------------------------------
// auto — infrastructure files the upgrade tool can safely overwrite
// ---------------------------------------------------------------------------

describe('classifyFile — auto', () => {
  it('classifies server middleware as auto', () => {
    expect(classifyFile('server/src/middleware/errorHandler.ts')).toBe('auto');
    expect(classifyFile('server/src/middleware/rateLimiter.ts')).toBe('auto');
    expect(classifyFile('server/src/middleware/requestLogger.ts')).toBe('auto');
    expect(classifyFile('server/src/middleware/validate.ts')).toBe('auto');
  });

  it('classifies server config logger as auto', () => {
    expect(classifyFile('server/src/config/logger.ts')).toBe('auto');
  });

  it('classifies useSocket hook as auto', () => {
    expect(classifyFile('client/src/hooks/useSocket.ts')).toBe('auto');
  });

  it('classifies CI workflow as auto', () => {
    expect(classifyFile('.github/workflows/ci.yml')).toBe('auto');
  });

  it('classifies eslint config as auto', () => {
    expect(classifyFile('eslint.config.js')).toBe('auto');
  });

  it('classifies nodemon.json as auto — infrastructure config, no project-specific values', () => {
    expect(classifyFile('server/nodemon.json')).toBe('auto');
  });
});

// ---------------------------------------------------------------------------
// recipe — .claude/skills/recipe/** always gets recipe treatment
// ---------------------------------------------------------------------------

describe('classifyFile — recipe', () => {
  it('classifies recipe references as recipe', () => {
    expect(classifyFile('.claude/skills/recipe/references/file-crud.md')).toBe('recipe');
    expect(classifyFile('.claude/skills/recipe/references/nav-shell.md')).toBe('recipe');
    expect(classifyFile('.claude/skills/recipe/SKILL.md')).toBe('recipe');
  });

  it('classifies recipe domains as recipe', () => {
    expect(classifyFile('.claude/skills/recipe/domains/care-provider-operations.md')).toBe('recipe');
  });
});

// ---------------------------------------------------------------------------
// never — project-owned files the upgrade tool must not overwrite
// ---------------------------------------------------------------------------

describe('classifyFile — never (basename rules)', () => {
  it('classifies package.json as never regardless of path', () => {
    expect(classifyFile('package.json')).toBe('never');
    expect(classifyFile('client/package.json')).toBe('never');
    expect(classifyFile('server/package.json')).toBe('never');
  });

  it('classifies .env files as never', () => {
    expect(classifyFile('.env')).toBe('never');
    expect(classifyFile('.env.example')).toBe('never');
  });

  it('classifies CLAUDE.md as never — heavily customized per project', () => {
    expect(classifyFile('CLAUDE.md')).toBe('never');
  });

  it('classifies README.md as never', () => {
    expect(classifyFile('README.md')).toBe('never');
  });
});

describe('classifyFile — never (exact path rules)', () => {
  it('classifies entry point files as never — project scope baked in', () => {
    expect(classifyFile('server/src/index.ts')).toBe('never');
    expect(classifyFile('client/src/main.tsx')).toBe('never');
    expect(classifyFile('client/src/App.tsx')).toBe('never');
    expect(classifyFile('client/index.html')).toBe('never');
  });

  it('classifies vite config as never — port numbers baked in', () => {
    expect(classifyFile('client/vite.config.ts')).toBe('never');
  });

  it('classifies env.ts as never — Zod schema + ports baked in at scaffold time', () => {
    expect(classifyFile('server/src/config/env.ts')).toBe('never');
  });

  it('classifies health and info routes as never — scope/port references', () => {
    expect(classifyFile('server/src/routes/health.ts')).toBe('never');
    expect(classifyFile('server/src/routes/info.ts')).toBe('never');
  });

  it('classifies entitySocket singleton as never — project-specific connection URL', () => {
    expect(classifyFile('client/src/lib/entitySocket.ts')).toBe('never');
  });

  it('classifies global CSS as never — project brand/theme lives here', () => {
    expect(classifyFile('client/src/styles/index.css')).toBe('never');
  });
});

describe('classifyFile — never (prefix rules)', () => {
  it('classifies all shared/src/ files as never — entity types are project-owned', () => {
    expect(classifyFile('shared/src/types.ts')).toBe('never');
    expect(classifyFile('shared/src/types/company.ts')).toBe('never');
  });

  it('classifies client pages as never — project UI', () => {
    expect(classifyFile('client/src/pages/LandingPage.tsx')).toBe('never');
    expect(classifyFile('client/src/pages/DashboardPage.tsx')).toBe('never');
  });

  it('classifies client components as never — project UI', () => {
    expect(classifyFile('client/src/components/Sidebar.tsx')).toBe('never');
  });

  it('classifies demo folder as never — deletable scaffolding', () => {
    expect(classifyFile('client/src/demo/DemoPage.tsx')).toBe('never');
  });
});

describe('classifyFile — never (tsconfig and vitest patterns)', () => {
  it('classifies tsconfig files as never', () => {
    expect(classifyFile('tsconfig.json')).toBe('never');
    expect(classifyFile('client/tsconfig.json')).toBe('never');
    expect(classifyFile('server/tsconfig.node.json')).toBe('never');
  });

  it('classifies vitest config files as never', () => {
    expect(classifyFile('vitest.config.ts')).toBe('never');
    expect(classifyFile('client/vitest.config.ts')).toBe('never');
    expect(classifyFile('server/vitest.config.ts')).toBe('never');
  });
});

describe('classifyFile — never (default fallback)', () => {
  it('classifies unknown files as never — conservative default', () => {
    expect(classifyFile('some-unknown-file.ts')).toBe('never');
    expect(classifyFile('scripts/custom-script.js')).toBe('never');
    expect(classifyFile('docs/my-notes.md')).toBe('never');
  });
});
