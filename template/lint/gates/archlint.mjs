/**
 * The archlint run behind the architecture gates (G13 cohesion, G14 coupling, G15 stability): one
 * workspace's production code copied to a disposable tree, scanned, and the findings handed back with
 * repo-relative paths. Copied from AppyRig's lint/gates/archlint-scan.mjs.
 *
 * The copy is how tests are left out (archlint 0.17.1 would still count ignored test imports in its graph
 * metrics), and it is the only thing edited: `.js` is stripped from the copy's relative imports, because
 * archlint follows `./x.js` to `x.ts` but not to `x.tsx`, so every edge into a React file would be missing.
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '../../..');
const ERROR_TAIL = 400;
const RUN_FAILED = 2;

/** Workspaces scanned, each with its own path alias (archlint resolves imports against one package root). */
export const WORKSPACES = ['client', 'server', 'shared'];

/** Contract files that only declare types. */
export const ARCHLINT_EXCLUDES = ['**/types.ts'];

const SKIPPED_FILE = /(?:(^|\/)test\/)|(?:\.(?:test|spec)\.[^/]+$)|(?:\.d\.ts$)/;
const JS_SPECIFIER = /(from\s+|import\s*\(\s*|import\s+)(['"])((?:\.{1,2}\/|@\w+\/)[^'"]*?)\.js\2/g;
const ARCHLINT_BIN = fileURLToPath(import.meta.resolve('@archlinter/cli/bin/archlint.js'));

function stripJsExtensions(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);

    if (statSync(path).isDirectory()) {
      stripJsExtensions(path);
    } else if (/\.tsx?$/.test(name)) {
      writeFileSync(path, readFileSync(path, 'utf8').replace(JS_SPECIFIER, '$1$2$3$2'));
    }
  }
}

/** Production files of one workspace copied to a disposable tree, with the archlint config beside them. */
function snapshot({ sourceDir, workspace, rules }) {
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'archlint-')));
  let copied = 0;

  cpSync(sourceDir, join(tmp, 'src'), {
    recursive: true,
    filter: (path) => {
      const keep = !SKIPPED_FILE.test(relative(sourceDir, path));

      copied += keep && /\.tsx?$/.test(path) ? 1 : 0;

      return keep;
    },
  });
  stripJsExtensions(join(tmp, 'src'));
  writeFileSync(join(tmp, 'package.json'), '{}');
  // The `lcom` rule is a switch: without it archlint resolves no symbol references. Its own findings are excluded.
  writeFileSync(
    join(tmp, 'archlint.json'),
    JSON.stringify({
      aliases: { [`@${workspace}/*`]: './src/*' },
      rules: { ...rules, lcom: { exclude: ['**/*'] } },
      tsconfig: false,
    })
  );

  return { tmp, copied };
}

function parseSmells({ result, tmp, workspace }) {
  let report;

  try {
    report = JSON.parse(result.stdout);
  } catch {
    throw new Error(`archlint printed no JSON (exit ${result.status}): ${result.stderr.slice(0, ERROR_TAIL)}`);
  }

  const prefix = `${workspace}/src`;
  const inRepo = (text) => text?.replaceAll(`${tmp}/src/`, `${prefix}/`);

  return (report.smells ?? []).map((smell) => ({
    ...smell,
    files: smell.files.map((file) => `${prefix}/${relative(join(tmp, 'src'), file)}`),
    locations: (smell.locations ?? []).map((l) => ({ ...l, description: inRepo(l.description) })),
  }));
}

/** archlint's findings for one workspace. Throws when the run did not look: never reported as clean. */
function workspaceSmells({ workspace, rules }) {
  const { tmp, copied } = snapshot({ sourceDir: join(ROOT, workspace, 'src'), workspace, rules });

  try {
    if (copied === 0) {
      throw new Error(`${workspace}/src holds no TypeScript files to scan`);
    }

    const args = ['scan', join(tmp, 'src'), '--config', join(tmp, 'archlint.json')];
    const detectors = ['--detectors', [...Object.keys(rules), 'lcom'].join(',')];
    const flags = ['--no-cache', '--no-git', '--json', '--quiet'];
    const result = spawnSync(process.execPath, [ARCHLINT_BIN, ...args, ...detectors, ...flags], {
      encoding: 'utf8',
    });

    return parseSmells({ result, tmp, workspace });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/** One number of an archlint finding, by its metric name. */
export function metric(smell, name) {
  return smell.metrics?.map((m) => m[name]).find((v) => typeof v === 'number');
}

/**
 * Runs one gate: scans `workspaces`, turns each finding into a message, and exits 1 on any (greenfield:
 * no baseline), 2 when a scan could not run, 0 when clean.
 */
export function runArchlintGate({ gate, workspaces, rules, messageFor }) {
  let smells;

  try {
    smells = workspaces.flatMap((workspace) => workspaceSmells({ workspace, rules }));
  } catch (error) {
    console.error(`${gate}: the run failed, so nothing was checked.\n${error.message}`);
    process.exit(RUN_FAILED);
  }

  if (smells.length) {
    console.error(`${gate} FAILED: ${smells.length} finding(s)\n${smells.map(messageFor).join('\n')}`);
    process.exit(1);
  }

  console.log(`${gate}: ok (${workspaces.join(', ')} scanned, 0 findings)`);
}
