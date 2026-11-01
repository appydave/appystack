// The template's auto-tier server files import through @config/@helpers/@test (gate G10, no '../').
// server/tsconfig.json and server/vitest.config.ts are never-tier, so an upgraded app keeps its old ones:
// add only the missing aliases into them, leaving every other value alone. A file we cannot patch
// safely (no `paths` object, no `defineConfig({`, an array or variable `alias`) gets an UPGRADE_TODO row.
// (The client already has every alias in 0.4.x.)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const ALIASES = { '@config': 'src/config', '@helpers': 'src/helpers', '@test': 'src/test' };
const PATHS_OPEN = /"paths"\s*:\s*\{/;
const ALIAS_OPEN = /(\balias\s*:\s*\{)/;
const PATH_IMPORT = /from\s+['"](?:node:)?path['"]/;

const read = (dir, rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), 'utf-8') : null);
const missingIn = (text, has) => Object.entries(ALIASES).filter(([name]) => !has(name, text));

// Returns the patched text, or null when the file is not shaped like a scaffold's.
function patchTsconfig(text, missing) {
  const m = PATHS_OPEN.exec(text);
  if (m === null) return null;
  const head = text.slice(0, m.index + m[0].length);
  const rest = text.slice(head.length);
  const entries = missing.map(([name, dir]) => `\n      "${name}/*": ["${dir}/*"]`);
  // an empty `paths: {}` gets no trailing comma and keeps its closing brace on its own line
  if (/^\s*\}/.test(rest)) return `${head}${entries.join(',')}\n    ${rest.trimStart()}`;
  return `${head}${entries.join(',')},${rest}`;
}

function patchVitest(text, missing) {
  const entries = missing.map(([name, dir]) => `'${name}': path.resolve(__dirname, '${dir}'),`).join('\n      ');
  let out;
  if (ALIAS_OPEN.test(text)) out = text.replace(ALIAS_OPEN, `$1\n      ${entries}`);
  else if (!/\bresolve\s*:/.test(text) && /defineConfig\(\{/.test(text)) {
    out = text.replace(
      /defineConfig\(\{/,
      `defineConfig({\n  resolve: {\n    alias: {\n      ${entries}\n    },\n  },`,
    );
  } else return null;
  return PATH_IMPORT.test(out) ? out : `import path from 'node:path';\n${out}`;
}

const hasPath = (name, text) => text.includes(`"${name}/*"`);
const hasAlias = (name, text) => new RegExp(`['"]${name}['"]`).test(text);
const FILES = [
  ['server/tsconfig.json', hasPath, patchTsconfig, 'Add to compilerOptions.paths'],
  [
    'server/vitest.config.ts',
    hasAlias,
    patchVitest,
    "Add `import path from 'node:path';` and `resolve: { alias: { ... } }` with",
  ],
];
const lineFor = (file, name, dir) =>
  file.endsWith('json') ? `\`"${name}/*": ["${dir}/*"]\`` : `\`'${name}': path.resolve(__dirname, '${dir}')\``;

// Returns true when the server was missing at least one alias (patched or flagged).
export function mergeServerAliases(consumerDir) {
  let missingAny = false;
  for (const [rel, has, patch, todoText] of FILES) {
    const text = read(consumerDir, rel);
    if (text === null) continue;
    const missing = missingIn(text, has);
    if (missing.length === 0) continue;
    missingAny = true;
    const patched = patch(text, missing);
    if (patched !== null) writeFileSync(join(consumerDir, rel), patched, 'utf-8');
    else appendUpgradeTodo(consumerDir, rel, `${todoText}: ${missing.map(([n, d]) => lineFor(rel, n, d)).join(', ')}`);
  }
  if (missingAny) {
    appendUpgradeTodo(
      consumerDir,
      'server/src ../ imports',
      'Run `npm run lint`: the new rule rejects every `../` import. Rewrite each to an alias (@config/, @helpers/, @test/); your own routes and tests keep `../` until you do',
    );
  }
  return missingAny;
}
