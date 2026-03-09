import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildAudit, renderAudit, groupByTopDir, KEY_TEMPLATE_FILES } from '../bin/audit.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDir(base, ...parts) {
  const full = join(base, ...parts);
  mkdirSync(full, { recursive: true });
  return full;
}

function makeFile(base, ...parts) {
  const full = join(base, ...parts);
  mkdirSync(join(base, ...parts.slice(0, -1)), { recursive: true });
  writeFileSync(full, 'placeholder');
  return full;
}

const noFilter = () => true;
const noNodeModules = (src) => !src.includes('node_modules');

// ---------------------------------------------------------------------------
// groupByTopDir
// ---------------------------------------------------------------------------

describe('groupByTopDir', () => {
  it('groups root-level files under __root__', () => {
    const result = groupByTopDir(['package.json', '.env.example']);
    expect(result.__root__).toEqual(['package.json', '.env.example']);
  });

  it('groups nested files by top-level directory', () => {
    const result = groupByTopDir(['client/index.html', 'client/vite.config.ts', 'server/src/index.ts']);
    expect(result.client).toEqual(['client/index.html', 'client/vite.config.ts']);
    expect(result.server).toEqual(['server/src/index.ts']);
  });

  it('handles mixed root and nested files', () => {
    const result = groupByTopDir(['README.md', 'client/index.html']);
    expect(result.__root__).toEqual(['README.md']);
    expect(result.client).toEqual(['client/index.html']);
  });

  it('returns empty object for empty input', () => {
    expect(groupByTopDir([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildAudit
// ---------------------------------------------------------------------------

describe('buildAudit', () => {
  let tmpTarget;
  let tmpTemplate;

  beforeEach(() => {
    const base = tmpdir();
    tmpTarget = join(base, `target-${Date.now()}`);
    tmpTemplate = join(base, `template-${Date.now()}`);
    mkdirSync(tmpTarget, { recursive: true });
    mkdirSync(tmpTemplate, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpTarget, { recursive: true, force: true });
    rmSync(tmpTemplate, { recursive: true, force: true });
  });

  it('marks template files as added when target is empty', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, 'client', 'index.html');

    const { kept, added } = buildAudit(tmpTarget, tmpTemplate, noFilter);

    expect(kept).toHaveLength(0);
    expect(added).toContain('package.json');
    expect(added).toContain('client/index.html');
  });

  it('marks files as kept when they already exist in target', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, 'README.md');
    makeFile(tmpTarget, 'README.md'); // already exists

    const { kept, added } = buildAudit(tmpTarget, tmpTemplate, noFilter);

    expect(kept).toContain('README.md');
    expect(added).toContain('package.json');
    expect(added).not.toContain('README.md');
  });

  it('identifies key template files that already exist', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, '.env.example');
    makeFile(tmpTarget, 'package.json'); // already exists
    makeFile(tmpTarget, '.env.example'); // already exists

    const { keyFilesKept } = buildAudit(tmpTarget, tmpTemplate, noFilter);

    expect(keyFilesKept).toContain('package.json');
    expect(keyFilesKept).toContain('.env.example');
  });

  it('reports no keyFilesKept when none already exist', () => {
    makeFile(tmpTemplate, 'package.json');

    const { keyFilesKept } = buildAudit(tmpTarget, tmpTemplate, noFilter);

    expect(keyFilesKept).toHaveLength(0);
  });

  it('respects the filter function', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, 'node_modules', 'some-dep', 'index.js');

    const { added } = buildAudit(tmpTarget, tmpTemplate, noNodeModules);

    expect(added).toContain('package.json');
    expect(added).not.toContain('node_modules/some-dep/index.js');
  });

  it('handles nested directories correctly', () => {
    makeFile(tmpTemplate, 'server', 'src', 'config', 'env.ts');
    makeFile(tmpTemplate, 'client', 'vite.config.ts');

    const { added } = buildAudit(tmpTarget, tmpTemplate, noFilter);

    expect(added).toContain('server/src/config/env.ts');
    expect(added).toContain('client/vite.config.ts');
  });

  it('returns empty arrays when template is empty', () => {
    const { kept, added, keyFilesKept } = buildAudit(tmpTarget, tmpTemplate, noFilter);
    expect(kept).toHaveLength(0);
    expect(added).toHaveLength(0);
    expect(keyFilesKept).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// renderAudit
// ---------------------------------------------------------------------------

describe('renderAudit', () => {
  let tmpTarget;
  let tmpTemplate;

  beforeEach(() => {
    const base = tmpdir();
    tmpTarget = join(base, `target-${Date.now()}`);
    tmpTemplate = join(base, `template-${Date.now()}`);
    mkdirSync(tmpTarget, { recursive: true });
    mkdirSync(tmpTemplate, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpTarget, { recursive: true, force: true });
    rmSync(tmpTemplate, { recursive: true, force: true });
  });

  it('renders tree view for small projects', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, 'README.md');
    makeFile(tmpTarget, 'CLAUDE.md'); // existing file not in template

    // Build audit from what the template provides
    makeFile(tmpTemplate, 'CLAUDE.md'); // simulate template has it too but target already has it
    const audit = buildAudit(tmpTarget, tmpTemplate, noFilter);
    const output = renderAudit(audit, 'my-app', tmpTarget);

    expect(output).toContain('my-app/');
    expect(output).toContain('[keep]');
    expect(output).toContain('[add]');
    expect(output).toContain('kept');
    expect(output).toContain('added');
  });

  it('shows warning when key template files are kept', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, '.env.example');
    makeFile(tmpTarget, 'package.json');
    makeFile(tmpTarget, '.env.example');

    const audit = buildAudit(tmpTarget, tmpTemplate, noFilter);
    const output = renderAudit(audit, 'my-app', tmpTarget);

    expect(output).toContain('⚠');
    expect(output).toContain('package.json');
  });

  it('shows no warning when no key files are kept', () => {
    makeFile(tmpTemplate, 'package.json');
    // target is empty — nothing kept

    const audit = buildAudit(tmpTarget, tmpTemplate, noFilter);
    const output = renderAudit(audit, 'my-app', tmpTarget);

    expect(output).not.toContain('⚠');
  });

  it('renders large project summary when kept files exceed threshold', () => {
    // Create 26 existing files in target + template to trigger large view
    for (let i = 0; i < 26; i++) {
      makeFile(tmpTemplate, 'client', `file-${i}.ts`);
      makeFile(tmpTarget, 'client', `file-${i}.ts`);
    }
    makeFile(tmpTemplate, 'package.json');

    const audit = buildAudit(tmpTarget, tmpTemplate, noFilter);
    const output = renderAudit(audit, 'big-app', tmpTarget);

    // Large view shows directory-level summary, not individual files
    expect(output).toContain('big-app');
    expect(output).toContain('[keep');
    expect(output).toContain('[add');
    // Should not list every individual file
    expect(output).not.toContain('file-0.ts');
  });

  it('counts are accurate in output', () => {
    makeFile(tmpTemplate, 'package.json');
    makeFile(tmpTemplate, 'README.md');
    makeFile(tmpTemplate, 'client', 'index.html');
    makeFile(tmpTarget, 'README.md'); // 1 kept

    const audit = buildAudit(tmpTarget, tmpTemplate, noFilter);
    const output = renderAudit(audit, 'my-app', tmpTarget);

    expect(output).toContain('1 kept');
    expect(output).toContain('2 added');
  });
});
