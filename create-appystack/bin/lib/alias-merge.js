// The template's auto-tier server files import through @config/@helpers/@test (gate G10, no '../').
// server/tsconfig.json and server/vitest.config.ts are never-tier, so an upgraded app keeps its old ones:
// add only the missing aliases into them, leaving every other value alone. A file we cannot patch
// safely (no `paths` object, no `defineConfig({`, an array or variable `alias`) gets an UPGRADE_TODO row.
// All matching runs on a copy with comments blanked out (same offsets), so a commented-out block is not patched.
// Named limits: a regex literal or an exotic string that hides a quote can fool the comment scan.
// (The client already has every alias in 0.4.x.)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const ALIASES = { '@config': 'src/config', '@helpers': 'src/helpers', '@test': 'src/test' };
const PATHS_OPEN = /"paths"\s*:\s*\{/;
const ALIAS_OPEN = /\balias\s*:\s*\{/;
const DEFINE_OPEN = /defineConfig\(\{/;
const PATH_BINDING = /\bimport\s+(?:\*\s+as\s+)?path\b/; // a binding NAMED path; `import { resolve } from` is not one
const DIRECTIVES = /^(?:\/\/\/[^\n]*\n)*/;

const read = (dir, rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), 'utf-8') : null);
const missingIn = (code, has) => Object.entries(ALIASES).filter(([name]) => !has(name, code));
const insertAt = (text, at, add) => text.slice(0, at) + add + text.slice(at);

// Replace every comment with spaces (newlines kept), skipping string literals, so offsets still line up.
function blankComments(text) {
  let out = '';
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const two = text.slice(i, i + 2);
    if (quote !== null) {
      out += c;
      if (c === '\\') out += text[++i] ?? '';
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += c;
    } else if (two === '//' || two === '/*') {
      const end = two === '//' ? text.indexOf('\n', i) : text.indexOf('*/', i) + 2;
      const stop = end > i && end !== 1 ? end : text.length;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
    } else out += c;
  }
  return out;
}

// Each patch returns the new text, or null when the file is not shaped like a scaffold's.
function patchTsconfig(text, code, missing, nl) {
  const m = PATHS_OPEN.exec(code);
  if (m === null) return null;
  const at = m.index + m[0].length;
  const entries = missing.map(([name, dir]) => `${nl}      "${name}/*": ["${dir}/*"]`).join(',');
  // an empty `paths: {}` gets no trailing comma and keeps its closing brace on its own line
  if (/^\s*\}/.test(code.slice(at))) return text.slice(0, at) + entries + `${nl}    ` + text.slice(at).trimStart();
  return insertAt(text, at, `${entries},`);
}

function patchVitest(text, code, missing, nl) {
  const lines = missing.map(([name, dir]) => `'${name}': path.resolve(__dirname, '${dir}'),`);
  let out;
  const alias = ALIAS_OPEN.exec(code);
  const define = DEFINE_OPEN.exec(code);
  if (alias !== null) out = insertAt(text, alias.index + alias[0].length, `${nl}      ${lines.join(`${nl}      `)}`);
  else if (define !== null && !/\bresolve\s*:/.test(code)) {
    const block = ['  resolve: {', '    alias: {', ...lines.map((l) => `      ${l}`), '    },', '  },'];
    out = insertAt(text, define.index + define[0].length, `${nl}${block.join(nl)}`);
  } else return null;
  if (PATH_BINDING.test(code)) return out;
  const head = DIRECTIVES.exec(out)[0];
  return head + `import path from 'node:path';${nl}` + out.slice(head.length);
}

const hasPath = (name, code) => code.includes(`"${name}/*"`);
const hasAlias = (name, code) => new RegExp(`['"]${name}['"]`).test(code);
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
    const code = blankComments(text);
    const missing = missingIn(code, has);
    if (missing.length === 0) continue;
    missingAny = true;
    const patched = patch(text, code, missing, text.includes('\r\n') ? '\r\n' : '\n');
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
