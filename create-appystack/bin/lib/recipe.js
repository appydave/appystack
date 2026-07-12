// Recipe file sync logic. Recipes are template-owned *intelligence* the developer
// invokes (via the recipe skill), not code they customize — so upgrades refresh them
// quietly instead of prompting on every one:
//
//   1. Not in consumer         → auto-add
//   2. Edited since scaffold    → protect it: show diff + prompt (needs a baseline)
//   3. Unedited / no baseline   → silently refresh to the template version
//
// This keeps `npx appystack-upgrade` quiet for the common case (untouched specs)
// while still protecting a developer who deliberately hand-edited a recipe.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Handle a recipe file (classified as 'recipe' by classify.js).
 *
 * @param {string} consumerDir      - Absolute path to consumer app root
 * @param {string} templateDir      - Absolute path to template directory
 * @param {string|null} scaffoldCommit - SHA string or null
 * @param {string} relativePath     - e.g. '.claude/skills/recipe/references/nav-shell.md'
 * @param {object} prompts          - @clack/prompts module (passed in)
 * @param {object} diffModule       - diff.js module (passed in)
 * @returns {Promise<{ action: string, path: string }>}
 */
export async function handleRecipeFile(
  consumerDir,
  templateDir,
  scaffoldCommit,
  relativePath,
  prompts,
  diffModule,
) {
  const consumerFilePath = join(consumerDir, relativePath);

  // 1. New file — auto-add, no conflict possible.
  if (!existsSync(consumerFilePath)) {
    diffModule.applyUpdate(consumerDir, templateDir, relativePath);
    return { action: 'added', path: relativePath };
  }

  // 2. Developer edited this recipe since scaffold — protect it (diff + prompt).
  //    Recipe specs carry no scaffold-time substitutions, so a non-empty git diff
  //    genuinely means a hand edit. Only detectable with a scaffold baseline.
  if (
    scaffoldCommit &&
    diffModule.isFileChangedSinceScaffold(consumerDir, scaffoldCommit, relativePath)
  ) {
    return diffModule.handleAutoFile(
      consumerDir,
      templateDir,
      scaffoldCommit,
      relativePath,
      prompts,
    );
  }

  // 3. Template-owned intelligence, unedited (or no baseline) — refresh silently.
  const consumerContent = readFileSync(consumerFilePath, 'utf-8');
  const templateContent = readFileSync(join(templateDir, relativePath), 'utf-8');
  if (consumerContent === templateContent) {
    return { action: 'identical', path: relativePath };
  }
  diffModule.applyUpdate(consumerDir, templateDir, relativePath);
  return { action: 'updated', path: relativePath };
}
