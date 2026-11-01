// Merge the gate-owned package.json entries from the template into the consumer's.
// package.json is never overwritten: only these scripts and devDependencies, read from the template.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

export const GATE_SCRIPTS = ['lint', 'lint:fix'];
export const GATE_DEV_DEPS = [
  '@stylistic/eslint-plugin',
  'eslint-plugin-oxlint',
  'eslint-plugin-sonarjs',
  'oxlint',
];
// Template values from before the gates; a consumer still on one of these has not customized it.
const PRIOR_SCRIPT_VALUES = {
  lint: ['eslint .'],
  'lint:fix': ['eslint . --fix'],
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
