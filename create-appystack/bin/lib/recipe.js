// WU06: recipe file sync logic — auto-add new files, always-diff SKILL.md, standard diff for existing

import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Handle a recipe file (classified as 'recipe' by classify.js).
 *
 * Rules:
 *   1. Not in consumer → auto-add (no prompt)
 *   2. SKILL.md        → always show diff + prompt (even if unchanged since scaffold)
 *   3. All other existing recipe files → standard diff engine (handleAutoFile)
 *
 * @param {string} consumerDir   - Absolute path to consumer app root
 * @param {string} templateDir   - Absolute path to template directory
 * @param {string|null} scaffoldCommit - SHA string or null
 * @param {string} relativePath  - e.g. '.claude/skills/recipe/references/nav-shell.md'
 * @param {object} prompts       - @clack/prompts module (passed in)
 * @param {object} diffModule    - diff.js module (passed in)
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
  const isSkillMd = relativePath.endsWith('SKILL.md');
  const existsInConsumer = existsSync(consumerFilePath);

  // -------------------------------------------------------------------------
  // 1. New file — auto-add, no conflict possible
  // -------------------------------------------------------------------------
  if (!existsInConsumer) {
    await diffModule.applyUpdate(consumerDir, templateDir, relativePath);
    return { action: 'added', path: relativePath };
  }

  // -------------------------------------------------------------------------
  // 2. SKILL.md — always show diff + prompt
  // -------------------------------------------------------------------------
  if (isSkillMd) {
    let diffOutput = '';
    let diffLabel = '';

    if (scaffoldCommit) {
      // Show git diff against scaffold commit
      try {
        diffOutput = execSync(`git diff ${scaffoldCommit} -- ${relativePath}`, {
          cwd: consumerDir,
          stdio: 'pipe',
        }).toString('utf-8');
        diffLabel = `git diff ${scaffoldCommit.slice(0, 7)} -- ${relativePath}`;
      } catch {
        diffOutput = '';
        diffLabel = `git diff ${scaffoldCommit.slice(0, 7)} -- ${relativePath} (git error)`;
      }
    } else {
      // No scaffold baseline — compare template vs current
      try {
        const templateContent = readFileSync(join(templateDir, relativePath), 'utf-8');
        const consumerContent = readFileSync(consumerFilePath, 'utf-8');
        if (templateContent === consumerContent) {
          diffOutput = '';
        } else {
          // Build a simple unified-diff-style display
          const templateLines = templateContent.split('\n');
          const consumerLines = consumerContent.split('\n');
          const removedLines = consumerLines
            .filter((l) => !templateLines.includes(l))
            .map((l) => `- ${l}`);
          const addedLines = templateLines
            .filter((l) => !consumerLines.includes(l))
            .map((l) => `+ ${l}`);
          diffOutput = [...removedLines, ...addedLines].join('\n');
        }
      } catch {
        diffOutput = '';
      }
      diffLabel = `No scaffold baseline — showing template vs current: ${relativePath}`;
    }

    // Show diff in a note block (first 60 lines)
    const diffLines = diffOutput.split('\n');
    const truncated = diffLines.length > 60;
    const displayLines = diffLines.slice(0, 60);
    const noteBody = displayLines.length > 0
      ? displayLines.join('\n') + (truncated ? `\n... (${diffLines.length - 60} more lines)` : '')
      : 'No changes detected';

    prompts.note(noteBody, diffLabel);

    // Prompt: skip / overwrite / mark-for-later
    const choice = await prompts.select({
      message: `SKILL.md — how do you want to handle ${relativePath}?`,
      options: [
        { value: 'skip',          label: 'Skip — keep current version' },
        { value: 'overwrite',     label: 'Overwrite — apply template version' },
        { value: 'mark-for-later', label: 'Mark for later — add to UPGRADE_TODO.md' },
      ],
    });

    if (prompts.isCancel(choice)) {
      return { action: 'cancelled', path: relativePath };
    }

    if (choice === 'overwrite') {
      await diffModule.applyUpdate(consumerDir, templateDir, relativePath);
      return { action: 'overwritten', path: relativePath };
    }

    if (choice === 'mark-for-later') {
      await diffModule.appendUpgradeTodo(consumerDir, relativePath);
      return { action: 'deferred', path: relativePath };
    }

    // 'skip'
    return { action: 'skipped', path: relativePath };
  }

  // -------------------------------------------------------------------------
  // 3. All other existing recipe files — standard diff engine
  // -------------------------------------------------------------------------
  return diffModule.handleAutoFile(consumerDir, templateDir, scaffoldCommit, relativePath, prompts);
}
