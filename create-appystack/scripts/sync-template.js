#!/usr/bin/env node
/**
 * sync-template.js
 * Copies ../template/ → ./template/ excluding noise directories.
 * Runs automatically as prepublishOnly.
 */
import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = resolve(__dirname, '../../template');
const dest = resolve(__dirname, '../template');

const EXCLUDE = new Set(['node_modules', 'dist', 'coverage', 'test-results', '.git']);

function filter(src) {
  const segment = src.split('/').pop();
  return !EXCLUDE.has(segment);
}

if (existsSync(dest)) {
  rmSync(dest, { recursive: true, force: true });
}

cpSync(src, dest, { recursive: true, filter });

console.log('✔ Template synced from ../template/ → ./template/');
