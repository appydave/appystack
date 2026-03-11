#!/usr/bin/env node
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';

// Resolve the upgrade binary from the create-appystack package
const require = createRequire(import.meta.url);
const pkgJson = require.resolve('create-appystack/package.json');
const upgradeBin = resolve(dirname(pkgJson), 'bin/upgrade.js');

await import(pathToFileURL(upgradeBin).href);
