import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { handleRecipeFile } from '../bin/lib/recipe.js';

const REL = '.claude/skills/recipe/references/nav-shell.md';

function write(dir, rel, content) {
  const p = join(dir, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf-8');
}

describe('handleRecipeFile — recipes refresh quietly, edits are protected', () => {
  let root, consumerDir, templateDir, diff;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'recipe-test-'));
    consumerDir = join(root, 'consumer');
    templateDir = join(root, 'template');
    mkdirSync(consumerDir, { recursive: true });
    mkdirSync(templateDir, { recursive: true });
    diff = {
      applyUpdate: vi.fn(),
      isFileChangedSinceScaffold: vi.fn(() => false),
      handleAutoFile: vi.fn(async () => ({ action: 'prompted', path: REL })),
    };
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it('auto-adds a recipe the consumer does not have', async () => {
    write(templateDir, REL, 'NEW');
    const r = await handleRecipeFile(consumerDir, templateDir, null, REL, {}, diff);
    expect(r.action).toBe('added');
    expect(diff.applyUpdate).toHaveBeenCalledOnce();
    expect(diff.handleAutoFile).not.toHaveBeenCalled();
  });

  it('skips silently when consumer matches the template (identical)', async () => {
    write(templateDir, REL, 'SAME');
    write(consumerDir, REL, 'SAME');
    const r = await handleRecipeFile(consumerDir, templateDir, null, REL, {}, diff);
    expect(r.action).toBe('identical');
    expect(diff.applyUpdate).not.toHaveBeenCalled();
    expect(diff.handleAutoFile).not.toHaveBeenCalled();
  });

  it('refreshes silently (no prompt) when unedited but drifted, no scaffold baseline', async () => {
    write(templateDir, REL, 'NEW TEMPLATE');
    write(consumerDir, REL, 'OLD SCAFFOLD');
    const r = await handleRecipeFile(consumerDir, templateDir, null, REL, {}, diff);
    expect(r.action).toBe('updated');
    expect(diff.applyUpdate).toHaveBeenCalledOnce();
    expect(diff.handleAutoFile).not.toHaveBeenCalled(); // <-- the noise fix: no prompt
  });

  it('refreshes silently when unedited since scaffold (baseline says unchanged)', async () => {
    write(templateDir, REL, 'NEW TEMPLATE');
    write(consumerDir, REL, 'OLD SCAFFOLD');
    diff.isFileChangedSinceScaffold.mockReturnValue(false);
    const r = await handleRecipeFile(consumerDir, templateDir, 'abc123', REL, {}, diff);
    expect(r.action).toBe('updated');
    expect(diff.handleAutoFile).not.toHaveBeenCalled();
  });

  it('protects a developer edit: prompts when the recipe changed since scaffold', async () => {
    write(templateDir, REL, 'NEW TEMPLATE');
    write(consumerDir, REL, 'DEVELOPER EDITED');
    diff.isFileChangedSinceScaffold.mockReturnValue(true);
    const r = await handleRecipeFile(consumerDir, templateDir, 'abc123', REL, {}, diff);
    expect(diff.handleAutoFile).toHaveBeenCalledOnce(); // routed to diff/prompt path
    expect(diff.applyUpdate).not.toHaveBeenCalled();
    expect(r.action).toBe('prompted');
  });
});
