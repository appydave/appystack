// Gate G16 (no re-exports): errorHandler.ts is auto-tier and no longer re-exports AppError. An app's own
// files that import it from there stop compiling after the upgrade: write one row per file.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage']);
const SOURCE = /\.[cm]?[jt]sx?$/;
// import { AppError } / import type { AppError, X } from '.../errorHandler(.js)'
const OLD_IMPORT = /import\s+(?:type\s+)?\{[^}]*\bAppError\b[^}]*\}\s*from\s*['"][^'"]*\/errorHandler(?:\.js)?['"]/;
const TEMPLATE_OWNED = 'server/src/middleware/errorHandler.ts';
const NEW_IMPORT = "import { AppError } from '@helpers/AppError.js';";

function* sourceFiles(dir, rel) {
  for (const entry of readdirSync(join(dir, rel), { withFileTypes: true })) {
    const path = `${rel}/${entry.name}`;
    if (entry.isDirectory() && !SKIP.has(entry.name)) yield* sourceFiles(dir, path);
    else if (entry.isFile() && SOURCE.test(entry.name)) yield path;
  }
}

// Returns true when it wrote at least one row.
export function appendAppErrorTodo(consumerDir) {
  if (!existsSync(join(consumerDir, 'server/src'))) return false;
  let wrote = false;
  for (const path of sourceFiles(consumerDir, 'server/src')) {
    if (path === TEMPLATE_OWNED || !OLD_IMPORT.test(readFileSync(join(consumerDir, path), 'utf-8'))) continue;
    appendUpgradeTodo(
      consumerDir,
      path,
      `\`errorHandler.js\` no longer re-exports \`AppError\` (lint rejects re-exports). Import it from its own file: \`${NEW_IMPORT}\` (needs the server @helpers alias: the upgrade adds it, or lists it in this file)`,
    );
    wrote = true;
  }
  return wrote;
}
