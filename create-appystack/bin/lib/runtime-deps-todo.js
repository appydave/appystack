// A 0.4.x app lacks packages the current template's code needs: the upgrade overwrites auto-tier files that
// import `@appydave/core` (server) and tests that use `@testing-library/dom` (client), and `@appydave/core`
// peers on zod 4. The upgrade does not add dependencies; it writes the proven install steps into UPGRADE_TODO.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const ZOD_MAJOR_NEEDED = 4;

function readDeps(consumerDir, rel) {
  const path = join(consumerDir, rel);
  if (!existsSync(path)) return null;
  const pkg = JSON.parse(readFileSync(path, 'utf-8'));
  return { ...pkg.devDependencies, ...pkg.dependencies };
}

const zodTooOld = (range) => {
  const major = /(\d+)/.exec(range ?? '');
  return major !== null && Number(major[1]) < ZOD_MAJOR_NEEDED;
};

// Returns true when it wrote at least one row.
export function appendRuntimeDepsTodo(consumerDir) {
  let wrote = false;

  const server = readDeps(consumerDir, 'server/package.json');
  if (server && (!server['@appydave/core'] || zodTooOld(server.zod))) {
    appendUpgradeTodo(
      consumerDir,
      'server/package.json',
      'The upgraded server code imports `@appydave/core`, which needs zod 4. Run `npm install -w server @appydave/core@^0.2.0 zod@^4 --legacy-peer-deps` (a plain install fails `ERESOLVE` on a 0.4.x lockfile), then a plain `npm install`',
    );
    wrote = true;
  }

  const client = readDeps(consumerDir, 'client/package.json');
  if (client && !client['@testing-library/dom']) {
    appendUpgradeTodo(
      consumerDir,
      'client/package.json',
      'The client tests need `@testing-library/dom`. Run `npm install -w client -D @testing-library/dom --legacy-peer-deps`, then a plain `npm install`',
    );
    wrote = true;
  }

  return wrote;
}
