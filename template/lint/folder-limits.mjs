#!/usr/bin/env node
/**
 * G09: folder size. Mirrors Omer's lint/folder-limits.js (spaghetti-busters 4e7a65f): a folder holds at
 * most 10 files and 10 subfolders. Greenfield: no baseline, any oversize folder fails.
 *
 * Counts git-tracked and not-ignored files, so a .DS_Store or a build folder cannot change the answer.
 * Exit: 0 clean, 1 findings, 2 the run itself failed (it counted nothing).
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const MAX_FILES = 10;
const MAX_SUBFOLDERS = 10;
const RUN_FAILED = 2;

/** Every code and test root; the folders under them are checked. */
const SCANNED = ['client/src', 'server/src', 'shared/src', 'e2e', 'scripts', 'lint'];

const inScope = (file) => SCANNED.some((r) => file.startsWith(`${r}/`));

/** Direct files and subfolders of every folder at or under a scanned root: { folder: { files, subfolders } }. */
export function folderSizes(files) {
  const direct = new Map();
  const children = new Map();
  const touch = (folder) => {
    if (!direct.has(folder)) {
      direct.set(folder, 0);
      children.set(folder, new Set());
    }
  };

  for (const file of files.filter(inScope)) {
    let folder = dirname(file);

    touch(folder);
    direct.set(folder, direct.get(folder) + 1);

    while (!SCANNED.includes(folder)) {
      const parent = dirname(folder);

      touch(parent);
      children.get(parent).add(folder);
      folder = parent;
    }
  }

  return [...direct].map(([folder, n]) => ({ folder, files: n, subfolders: children.get(folder).size }));
}

/** One message per limit a folder is over. */
export function findings(sizes) {
  return sizes.flatMap(({ folder, files, subfolders }) => [
    ...(files > MAX_FILES
      ? [`${folder} has ${files} direct files; maximum is ${MAX_FILES}. Split it into subfolders by feature.`]
      : []),
    ...(subfolders > MAX_SUBFOLDERS
      ? [
          `${folder} has ${subfolders} subfolders; maximum is ${MAX_SUBFOLDERS}. Group related subfolders under a parent folder by feature.`,
        ]
      : []),
  ]);
}

function listFiles() {
  const r = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...SCANNED], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  // A file deleted in the working tree is still in the index until it is committed.
  return r.status === 0 ? r.stdout.split('\n').filter((f) => f && existsSync(join(ROOT, f))) : [];
}

function main() {
  const files = listFiles();

  if (!files.length) {
    console.error('folder-limits: git listed no files, so nothing was checked.');
    process.exit(RUN_FAILED);
  }

  const sizes = folderSizes(files);
  const found = findings(sizes);

  if (found.length) {
    console.error(`folder-limits FAILED: ${found.length} finding(s)\n${found.join('\n')}`);
    process.exit(1);
  }

  console.log(`folder-limits ok: ${sizes.length} folders checked`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
