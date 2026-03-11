// WU05: diff engine — git diff against scaffold commit, prompt, UPGRADE_TODO.md
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';

// ---------------------------------------------------------------------------
// isFileChangedSinceScaffold(consumerDir, scaffoldCommit, relativePath)
//
// Returns true if the file has been modified since the scaffold commit.
// Returns false if unchanged, if scaffoldCommit is null, or if git fails.
// ---------------------------------------------------------------------------

export function isFileChangedSinceScaffold(consumerDir, scaffoldCommit, relativePath) {
  if (!scaffoldCommit) return false;

  try {
    const output = execSync(`git diff ${scaffoldCommit} -- ${relativePath}`, {
      cwd: consumerDir,
      stdio: 'pipe',
    }).toString('utf-8');

    return output.trim().length > 0;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// applyUpdate(consumerDir, templateDir, relativePath)
//
// Copies the file from templateDir to consumerDir, creating intermediate
// directories if needed. Returns 'updated'.
// ---------------------------------------------------------------------------

export function applyUpdate(consumerDir, templateDir, relativePath) {
  const destPath = join(consumerDir, relativePath);
  const srcPath = join(templateDir, relativePath);

  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);

  return 'updated';
}

// ---------------------------------------------------------------------------
// appendUpgradeTodo(consumerDir, relativePath)
//
// Appends an entry to UPGRADE_TODO.md in the consumer app root.
// Creates the file with header if it doesn't exist.
// ---------------------------------------------------------------------------

export function appendUpgradeTodo(consumerDir, relativePath) {
  const todoPath = join(consumerDir, 'UPGRADE_TODO.md');

  if (!existsSync(todoPath)) {
    const header = [
      '# UPGRADE_TODO.md',
      '',
      'Files that need manual merge after running `npx appystack-upgrade`.',
      'Review each file and apply relevant changes from the AppyStack template.',
      '',
      '| File | Action needed |',
      '|------|---------------|',
      '',
    ].join('\n');
    writeFileSync(todoPath, header, 'utf-8');
  }

  const row = `| \`${relativePath}\` | Review AppyStack changes and merge manually |\n`;
  const existing = readFileSync(todoPath, 'utf-8');
  writeFileSync(todoPath, existing + row, 'utf-8');
}

// ---------------------------------------------------------------------------
// handleAutoFile(consumerDir, templateDir, scaffoldCommit, relativePath, prompts)
//
// Main decision function for 'auto'-classified files.
// `prompts` is the @clack/prompts module — passed in to keep this module
// testable without interactive dependencies.
//
// Returns: { action: 'added' | 'updated' | 'skipped' | 'todo', path: relativePath }
// ---------------------------------------------------------------------------

export async function handleAutoFile(consumerDir, templateDir, scaffoldCommit, relativePath, prompts) {
  const { note, select, isCancel } = prompts;
  const destPath = join(consumerDir, relativePath);
  const srcPath = join(templateDir, relativePath);

  // 1. File does not exist in consumer → just add it
  if (!existsSync(destPath)) {
    applyUpdate(consumerDir, templateDir, relativePath);
    return { action: 'added', path: relativePath };
  }

  // 2. No scaffold baseline — compare content directly
  if (!scaffoldCommit) {
    const consumerContent = readFileSync(destPath, 'utf-8');
    const templateContent = readFileSync(srcPath, 'utf-8');

    if (consumerContent === templateContent) {
      // Identical to template — nothing to do, skip silently
      return { action: 'identical', path: relativePath };
    }

    // Files differ — show content diff and prompt (same as modified flow)
    const diffLines = buildContentDiff(templateContent, consumerContent);
    note(diffLines || '(no differences detected)', `Template vs current: ${relativePath}`);

    return promptForMerge(relativePath, consumerDir, templateDir, prompts);
  }

  // 3. Has scaffold baseline — check if consumer changed since scaffold
  if (!isFileChangedSinceScaffold(consumerDir, scaffoldCommit, relativePath)) {
    // Unchanged since scaffold → safe to overwrite with template
    applyUpdate(consumerDir, templateDir, relativePath);
    return { action: 'updated', path: relativePath };
  }

  // 4. File modified since scaffold — show git diff and prompt
  let diffOutput = '';
  try {
    diffOutput = execSync(`git diff ${scaffoldCommit} -- ${relativePath}`, {
      cwd: consumerDir,
      stdio: 'pipe',
    })
      .toString('utf-8')
      .split('\n')
      .slice(0, 50)
      .join('\n');
  } catch {
    diffOutput = '(could not retrieve diff)';
  }

  note(diffOutput || '(no diff output)', `Modified since scaffold: ${relativePath}`);

  return promptForMerge(relativePath, consumerDir, templateDir, prompts);
}

// ---------------------------------------------------------------------------
// buildContentDiff — simple line-level diff summary (template vs consumer)
// ---------------------------------------------------------------------------

function buildContentDiff(templateContent, consumerContent) {
  const tLines = templateContent.split('\n');
  const cLines = consumerContent.split('\n');
  const out = [];
  const maxLen = Math.max(tLines.length, cLines.length);
  let shown = 0;
  for (let i = 0; i < maxLen && shown < 50; i++) {
    if (tLines[i] !== cLines[i]) {
      if (tLines[i] !== undefined) out.push(`+ ${tLines[i]}`);
      if (cLines[i] !== undefined) out.push(`- ${cLines[i]}`);
      shown++;
    }
  }
  if (shown === 50 && maxLen > 50) out.push(`... (${maxLen - 50} more lines differ)`);
  return out.join('\n');
}

// ---------------------------------------------------------------------------
// promptForMerge — shared prompt for both baseline and no-baseline paths
// ---------------------------------------------------------------------------

async function promptForMerge(relativePath, consumerDir, templateDir, prompts) {
  const { select, isCancel } = prompts;

  const answer = await select({
    message: `File differs from template: ${relativePath}`,
    options: [
      { value: 'skip',      label: 'Skip',           hint: 'keep your version' },
      { value: 'overwrite', label: 'Overwrite',      hint: 'replace with latest AppyStack version' },
      { value: 'todo',      label: 'Mark for later', hint: 'added to UPGRADE_TODO.md' },
    ],
  });

  if (isCancel(answer)) return { action: 'skipped', path: relativePath };
  if (answer === 'overwrite') {
    applyUpdate(consumerDir, templateDir, relativePath);
    return { action: 'updated', path: relativePath };
  }
  if (answer === 'todo') {
    appendUpgradeTodo(consumerDir, relativePath);
    return { action: 'todo', path: relativePath };
  }
  return { action: 'skipped', path: relativePath };
}
