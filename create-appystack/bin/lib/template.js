// WU03: template dir resolution and file walking

import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXCLUDED_DIRS = new Set(['node_modules', 'dist', 'coverage', 'test-results', '.git']);
const EXCLUDED_FILES = new Set(['.DS_Store']);

/**
 * Resolves the template directory path.
 *
 * @param {string|null} overridePath - Optional path from --template-path CLI flag
 * @returns {string} Absolute path to the template directory
 */
export function resolveTemplateDir(overridePath) {
  const templateDir = overridePath
    ? resolve(overridePath)
    : resolve(__dirname, '../../template');

  if (!existsSync(templateDir)) {
    throw new Error(
      `Template directory not found: ${templateDir}. Run 'npm run sync' in create-appystack/ first.`
    );
  }

  return templateDir;
}

/**
 * Recursively walks templateDir and returns all file paths relative to it.
 *
 * @param {string} templateDir - Absolute path to the template directory
 * @returns {string[]} Sorted array of relative file paths using forward slashes
 */
export function walkTemplateFiles(templateDir) {
  const results = [];

  function walk(dir) {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      if (EXCLUDED_FILES.has(entry)) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entry)) {
          walk(fullPath);
        }
      } else {
        const rel = relative(templateDir, fullPath).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  walk(templateDir);
  results.sort();
  return results;
}
