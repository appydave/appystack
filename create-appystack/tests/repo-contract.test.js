import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Guards the repo-level facts that docs/AGENT-NOTES.md tells agents to rely on.
// Reads the repo-root template/ (the source), not create-appystack/template/ (the synced copy).
// These are source-contract checks: the behaviours they protect need a live port, Overmind or a
// real .env, which the unit suites cannot provide.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf-8');
const readJson = (rel) => JSON.parse(read(rel));

describe('Feature: repo-root test runner', () => {
  const pkg = readJson('package.json');

  it('Scenario: given the root package.json, when npm test runs, then create-appystack runs before the template', () => {
    const steps = pkg.scripts.test.split('&&').map((s) => s.trim());
    expect(steps).toEqual(['npm run test:create-appystack', 'npm run test:template']);
  });

  it('Scenario: given the create-appystack script, when it runs, then it tests inside create-appystack/', () => {
    expect(pkg.scripts['test:create-appystack']).toMatch(/^cd create-appystack && .*&& npm test$/);
  });

  it('Scenario: given the template script, when it runs, then shared is built before the template tests', () => {
    const script = pkg.scripts['test:template'];
    expect(script).toMatch(/^cd template && /);
    expect(script.indexOf('npm run build -w shared')).toBeGreaterThan(-1);
    expect(script.indexOf('npm run build -w shared')).toBeLessThan(script.lastIndexOf('npm test'));
  });

  it('Scenario: given the root package.json, when read, then it is not a workspace root', () => {
    expect(pkg.workspaces).toBeUndefined();
  });
});

describe('Feature: agent notes are wired in and traceable', () => {
  const notes = read('docs/AGENT-NOTES.md');

  it('Scenario: given CLAUDE.md, when read, then it imports the notes on their own line', () => {
    expect(read('CLAUDE.md').split('\n')).toContain('@docs/AGENT-NOTES.md');
  });

  it('Scenario: given the notes, when counted, then they stay within 200 lines', () => {
    expect(notes.split('\n').length).toBeLessThanOrEqual(200);
  });

  it('Scenario: given each learning slug the notes cite, when looked up, then docs/kdd/learnings has that file', () => {
    const slugs = [...notes.matchAll(/^\s*\(([a-z0-9-]+)\)\s*$/gm)].map((m) => m[1]);
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(fs.existsSync(path.join(repoRoot, 'docs/kdd/learnings', `${slug}.md`)), slug).toBe(true);
    }
  });

  it('Scenario: given each source the notes list, when looked up, then the file exists', () => {
    const front = notes.split('---')[1];
    const sources = [...front.matchAll(/^\s+- (\S+)$/gm)].map((m) => m[1]);
    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) {
      expect(fs.existsSync(path.join(repoRoot, src)), src).toBe(true);
    }
  });
});

describe('Feature: pitfalls the notes say must stay', () => {
  it('Scenario: given template env.ts, when dotenv is configured, then override is off only under test', () => {
    const env = read('template/server/src/config/env.ts');
    expect(env).toMatch(/dotenv\.config\(\{[^}]*override:\s*!underTest\s*\}\)/);
    expect(env).toMatch(/const underTest = process\.env\.VITEST === 'true' \|\| process\.env\.NODE_ENV === 'test'/);
  });

  it('Scenario: given the port-conflict defence, when its three parts are read, then all are present', () => {
    expect(read('template/client/vite.config.ts')).toMatch(/strictPort:\s*true/);
    expect(readJson('template/package.json').scripts.dev).toContain('--kill-others');

    const index = read('template/server/src/index.ts');
    const onError = index.search(/^\s*httpServer\.on\('error', onListenError\(env\.PORT\)\);/m);
    const listen = index.search(/^\s*httpServer\.listen\(env\.PORT/m);
    expect(onError).toBeGreaterThan(-1);
    expect(listen).toBeGreaterThan(-1);
    expect(onError).toBeLessThan(listen);
  });

  it('Scenario: given the server source, when it starts, then it never kills the process holding its port', () => {
    const server = ['index.ts', 'listenError.ts'].map((f) => read(`template/server/src/${f}`)).join('\n');
    expect(server).not.toMatch(/cleanupPort|kill -9|lsof -ti/);
  });

  it('Scenario: given start.sh with a stale .overmind.sock, when it checks liveness, then it greps for running and quits the daemon before removing the socket', () => {
    const start = read('template/scripts/start.sh');
    expect(start).toMatch(/overmind status 2>\/dev\/null \| grep -qw running/);
    const quit = start.indexOf('overmind quit');
    expect(quit).toBeGreaterThan(-1);
    expect(quit).toBeLessThan(start.indexOf('rm -f .overmind.sock'));
  });

  it('Scenario: given the template tree, when its ignore file is looked up, then it ships as gitignore without the dot', () => {
    expect(fs.existsSync(path.join(repoRoot, 'template/gitignore'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'template/.gitignore'))).toBe(false);
  });
});

describe('Feature: this repo fails its own build on a duplicated-code finding', () => {
  it('Scenario: given the template, when npm run dup is called there, then the script exists to be run', () => {
    expect(readJson('template/package.json').scripts.dup).toMatch(/jscpd --config/);
  });
});

describe('Feature: the root CI workflow is pinned step by step', () => {
  // One entry per step (the first also holds the file head, the last of the first job also holds the
  // second job's header): every line, trimmed, joined with ' ; '. Dropping, adding, changing or
  // reordering any line, such as 'continue-on-error: true' or 'if: false', changes the list.
  const STEPS = [
    'name: CI ; on: ; push: ; branches: [main] ; pull_request: ; branches: [main] ; jobs: ; ci: ; name: Format, typecheck, lint, test, coverage ; runs-on: ubuntu-latest ; steps:',
    'uses: actions/checkout@v4',
    'uses: actions/setup-node@v4 ; with: ; node-version: 24',
    'name: Install dependencies ; run: npm install ; working-directory: template',
    'name: Build shared ; run: npm run build --workspace=shared ; working-directory: template',
    'name: Format ; run: npm run format:check ; working-directory: template',
    'name: Typecheck ; run: npm run typecheck ; working-directory: template',
    'name: Lint ; run: npm run lint ; working-directory: template',
    'name: Duplicates ; run: npm run dup ; working-directory: template',
    'name: Dead code and import cycles ; run: npm run deadcode ; working-directory: template',
    'name: Test ; run: npm test ; working-directory: template',
    'name: create-appystack tests ; run: npm ci && npm test ; working-directory: create-appystack',
    'name: Coverage thresholds (server, client) ; run: npm run test:coverage ; working-directory: template ; e2e: ; name: Browser tests ; runs-on: ubuntu-latest ; timeout-minutes: 20 ; steps:',
    'uses: actions/checkout@v4',
    'uses: actions/setup-node@v4 ; with: ; node-version: 24',
    'name: Install dependencies ; run: npm install ; working-directory: template',
    'name: Build shared ; run: npm run build --workspace=shared ; working-directory: template',
    'name: Install the browser ; run: npx playwright install --with-deps chromium ; working-directory: template',
    'name: Playwright (starts its own server and client) ; run: npm run test:e2e ; working-directory: template',
    'name: Keep the failure traces ; if: failure() ; uses: actions/upload-artifact@v4 ; with: ; name: playwright-test-results ; path: template/test-results/ ; if-no-files-found: ignore',
  ];

  it('Scenario: given .github/workflows/ci.yml, when it is read, then it is exactly the reviewed workflow', () => {
    const actual = read('.github/workflows/ci.yml')
      .split('\n      - ')
      .map((part) =>
        part
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join(' ; '),
      );

    expect(
      actual,
      'The root ci.yml no longer matches this pin. A CI step may not be altered without editing STEPS in this test in the same change.',
    ).toEqual(STEPS);
  });
});
