// The template's auto-tier server files import through @config/@helpers/@test (gate G10, no '../').
// server/tsconfig.json and server/vitest.config.ts are never-tier, so an upgraded app keeps its old
// ones: write the exact lines it must add to UPGRADE_TODO.md. (The client already has every alias in 0.4.x.)
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const ALIASES = { '@config': 'src/config', '@helpers': 'src/helpers', '@test': 'src/test' };

const read = (dir, rel) => (existsSync(join(dir, rel)) ? readFileSync(join(dir, rel), 'utf-8') : null);

// Returns true when it wrote at least one row.
export function appendServerAliasTodo(consumerDir) {
  const tsconfig = read(consumerDir, 'server/tsconfig.json');
  const vitest = read(consumerDir, 'server/vitest.config.ts');
  if (tsconfig === null && vitest === null) return false;
  const pathLines = Object.entries(ALIASES)
    .filter(([name]) => tsconfig !== null && !tsconfig.includes(`"${name}/*"`))
    .map(([name, dir]) => `\`"${name}/*": ["${dir}/*"]\``);
  const aliasLines = Object.entries(ALIASES)
    .filter(([name]) => vitest !== null && !new RegExp(`['"]${name}['"]`).test(vitest))
    .map(([name, dir]) => `\`'${name}': path.resolve(__dirname, '${dir}')\``);
  if (pathLines.length > 0) {
    appendUpgradeTodo(consumerDir, 'server/tsconfig.json', `Add to compilerOptions.paths: ${pathLines.join(', ')}`);
  }
  if (aliasLines.length > 0) {
    appendUpgradeTodo(
      consumerDir,
      'server/vitest.config.ts',
      `Add \`import path from 'node:path';\` and \`resolve: { alias: { ... } }\` with: ${aliasLines.join(', ')}`,
    );
  }
  if (pathLines.length + aliasLines.length === 0) return false;
  appendUpgradeTodo(
    consumerDir,
    'server/src ../ imports',
    'Run `npm run lint`: the new rule rejects every `../` import. Rewrite each to an alias (@config/, @helpers/, @test/); your own routes and tests keep `../` until you do',
  );
  return true;
}
