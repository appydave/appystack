import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { buildPackage } from './helpers/build-package.js';

const NO_GITHUB = ['--no-github'];

// stdin is 'ignore': the child sees no terminal, as in CI or a pipe. npm runs offline so the
// scaffold's install step fails fast (it is non-fatal and not what these tests cover).
let bin;
const scaffold = (cwd, args) =>
  spawnSync(process.execPath, [bin, ...args], {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    env: { ...process.env, npm_config_offline: 'true' },
    timeout: 120000,
  });
const read = (dir, rel) => readFileSync(join(dir, rel), 'utf-8');

describe('create-appystack with no terminal', () => {
  let work;
  let pkgRoot;
  beforeAll(() => {
    work = mkdtempSync(join(tmpdir(), 'cli-b-'));
    pkgRoot = mkdtempSync(join(tmpdir(), 'cli-b-pkg-'));
    bin = buildPackage(pkgRoot);
  }, 60000);
  afterAll(() => {
    for (const dir of [work, pkgRoot]) {
      if (!resolve(dir).startsWith(resolve(tmpdir()) + '/')) throw new Error(`refusing to remove ${dir}`);
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it.each([
    ['no arguments', [], 'the project name'],
    ['--yes without a name', ['--yes'], 'the project name'],
    ['a name but no --scope', ['a-one', ...NO_GITHUB], '--scope'],
    ['a name and scope but no --port', ['a-two', '--scope', '@x', ...NO_GITHUB], '--port'],
  ])('%s exits non-zero, says what is missing, creates nothing', (_label, args, missing) => {
    const before = readdirSync(work);
    const run = scaffold(work, args);

    expect(run.status, run.stderr).toBe(1);
    expect(run.stderr).toContain(`no terminal to ask for ${missing}`);
    expect(readdirSync(work)).toEqual(before);
  });

  it('--yes with only a name creates the app with the default scope and ports', () => {
    const run = scaffold(work, ['b-defaults', '--yes', ...NO_GITHUB]);
    const app = join(work, 'b-defaults');

    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(read(app, 'package.json')).name).toBe('@myorg/b-defaults');
    expect(read(app, '.env.example')).toContain('PORT=5501');
    expect(read(app, '.vscode/launch.json')).toContain('"PORT": "5501"');
  }, 60000);

  it('--port 5600 rewrites launch.json to 5600/5601 and leaves no 5500/5501', () => {
    const run = scaffold(work, ['b-ports', '--yes', '--scope', '@acme', '--port', '5600', ...NO_GITHUB]);
    const launch = read(join(work, 'b-ports'), '.vscode/launch.json');

    expect(run.status, run.stderr).toBe(0);
    expect(launch).toContain('"PORT": "5601"');
    expect(launch).toContain('"CLIENT_URL": "http://localhost:5600"');
    expect(launch).toContain('"url": "http://localhost:5600"');
    expect(launch).not.toMatch(/550[01]/);
  }, 60000);
});
