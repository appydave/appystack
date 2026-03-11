#!/usr/bin/env node
/**
 * appystack-upgrade CLI
 * Usage: npx appystack-upgrade [flags]
 *
 * Flags:
 *   --template-path  Override the default template directory path
 *   --version        Print the CLI version and exit
 */
import { intro, outro, cancel, isCancel, note } from '@clack/prompts';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATE_DIR = resolve(__dirname, '../template');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template-path' && args[i + 1]) { flags.templatePath = args[++i]; }
    else if (args[i] === '--version')                  { flags.version = true; }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseArgs();

  // --version: print and exit
  if (cli.version) {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'));
    console.log(pkg.version);
    process.exit(0);
  }

  const templateDir = cli.templatePath ?? DEFAULT_TEMPLATE_DIR;
  const cwd = process.cwd();

  intro('appystack-upgrade');

  note(
    [
      `Checking consumer app at: ${cwd}`,
      `Template source: ${templateDir}`,
    ].join('\n'),
    'appystack-upgrade'
  );

  outro('Done (not yet implemented)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
