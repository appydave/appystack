// Merge the gate-owned package.json entries from the template into the consumer's.
// package.json is never overwritten: only these scripts and devDependencies, read from the template.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

// pretest / pretypecheck build `shared` first: a fresh checkout has no shared/dist and test/typecheck cannot resolve it
export const GATE_SCRIPTS = ['lint', 'lint:fix', 'dup', 'deadcode', 'pretest', 'pretypecheck'];
export const GATE_DEV_DEPS = [
  '@stylistic/eslint-plugin',
  'dependency-cruiser',
  'eslint-plugin-oxlint',
  'eslint-plugin-sonarjs',
  'jscpd',
  'knip',
  'oxlint',
  'tsx', // the root customize script runs it; it used to live only in server/
];
// Template values from before the gates; a consumer still on one of these has not customized it.
const PRIOR_SCRIPT_VALUES = {
  lint: [
    'eslint .',
    // 0.5.0 and 0.5.1 shipped the same lint script, before `--max-warnings 0`
    "grep -rqE '(eslint|oxlint)-disable' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=build --exclude-dir=coverage --exclude-dir=playwright-report --exclude-dir=test-results --exclude-dir=.claude . ; [ $? -eq 1 ] && oxlint --deny-warnings && eslint .",
  ],
  'lint:fix': ['eslint . --fix'],
  dup: [], // new with the duplicates gate: no earlier template value to recognise
  pretest: [], // new hook: no earlier template value
  pretypecheck: [], // new hook: no earlier template value
  deadcode: [
    // the first dead-code gate: Knip plus a cycle check of each workspace's src only
    "grep -rqE '@(public|internal|beta|alias)' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage . ; [ $? -eq 1 ] && knip && (cd client && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd server && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd shared && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src)",
    // P4: root cruise skipping build/dist/etc. at any depth (hid a cycle under scripts/build/)
    "grep -rqE '@(public|internal|beta|alias)' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.mjs' --include='*.cjs' --include='*.mts' --include='*.cts' --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=coverage . ; [ $? -eq 1 ] && knip && (cd client && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd server && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && (cd shared && depcruise -c ../.dependency-cruiser.cjs --ts-config tsconfig.json src) && depcruise -c .dependency-cruiser.cjs -x '^(client|server|shared)/|(^|/)(node_modules|dist|build|coverage|playwright-report|test-results)/' .",
  ],
};

const readJson = (path) => JSON.parse(readFileSync(path, 'utf-8'));

// Returns the entries it changed, as "scripts.lint" style names. Lockfile is never touched.
export function mergeGatePackage(consumerDir, templateDir) {
  const consumerPath = join(consumerDir, 'package.json');
  const templatePath = join(templateDir, 'package.json');
  if (!existsSync(consumerPath) || !existsSync(templatePath)) return [];
  const consumer = readJson(consumerPath);
  const template = readJson(templatePath);
  const changed = [];

  const apply = (section, name, canReplace) => {
    const want = template[section]?.[name];
    if (want === undefined) return;
    const have = consumer[section]?.[name];
    if (have === want) return;
    if (have !== undefined && !canReplace(have)) {
      appendUpgradeTodo(consumerDir, `package.json (${section}.${name} → ${want})`);
      return;
    }
    consumer[section] = { ...consumer[section], [name]: want };
    changed.push(`${section}.${name}`);
  };

  for (const name of GATE_SCRIPTS) apply('scripts', name, (v) => PRIOR_SCRIPT_VALUES[name].includes(v));
  for (const name of GATE_DEV_DEPS) apply('devDependencies', name, () => false);

  if (changed.includes('scripts.lint')) {
    appendUpgradeTodo(
      consumerDir,
      'npm run format',
      'Run it once, in its own commit: `npm run format:check` fails on files a 0.4.x scaffold left unformatted (about 34 on a stock 0.4.18 app: scaffold docs, skills and a few sources)',
    );
  }

  if (changed.includes('scripts.deadcode')) {
    appendUpgradeTodo(consumerDir, 'npm run deadcode', 'Run it and fix what it reports: your own dead code and import cycles surface now');
  }

  if (changed.length > 0) {
    if (consumer.devDependencies) {
      consumer.devDependencies = Object.fromEntries(
        Object.entries(consumer.devDependencies).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    writeFileSync(consumerPath, JSON.stringify(consumer, null, 2) + '\n', 'utf-8');
  }
  return changed;
}
