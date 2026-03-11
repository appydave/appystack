#!/usr/bin/env node
import * as prompts from '@clack/prompts';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolveTemplateDir, walkTemplateFiles } from './lib/template.js';
import { detectScaffoldInfo, writeAppystackJson } from './lib/version.js';
import { classifyFile } from './lib/classify.js';
import { handleAutoFile } from './lib/diff.js';
import * as diffModule from './lib/diff.js';
import { handleRecipeFile } from './lib/recipe.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template-path' && args[i + 1]) { flags.templatePath = args[++i]; }
    else if (args[i] === '--version')                  { flags.version = true; }
    else if (args[i] === '--yes')                      { flags.yes = true; }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Auto-accept prompts object for --yes mode
// Selects 'skip' for any select() call — safest non-destructive default.
// ---------------------------------------------------------------------------

function buildAutoPrompts() {
  return {
    ...prompts,
    select: async () => 'skip',
    text: async (opts) => opts.initialValue ?? '',
    isCancel: () => false,
  };
}

// ---------------------------------------------------------------------------
// Summary helpers
// ---------------------------------------------------------------------------

function tallySummary(results) {
  const tally = { added: [], updated: [], todo: [], skipped: [], owned: [] };
  for (const r of results) {
    if (r.action === 'added')                                      tally.added.push(r.path);
    else if (r.action === 'updated' || r.action === 'overwritten') tally.updated.push(r.path);
    else if (r.action === 'todo' || r.action === 'deferred')       tally.todo.push(r.path);
    else if (r.action === 'skipped' || r.action === 'cancelled')   tally.skipped.push(r.path);
    else if (r.action === 'owned' || r.action === 'identical')     tally.owned.push(r.path);
  }
  return tally;
}

function formatSummary(tally) {
  const lines = [];

  function section(icon, label, paths, extra) {
    if (paths.length === 0) {
      lines.push(`${icon} ${label}: 0 files`);
    } else {
      lines.push(`${icon} ${label}: ${paths.length} file${paths.length === 1 ? '' : 's'}${extra ?? ''}`);
      for (const p of paths) lines.push(`    ${p}`);
    }
  }

  section('✔', 'Added   ', tally.added);
  section('✔', 'Updated ', tally.updated);
  section('⚠', 'Todo    ', tally.todo, '  (see UPGRADE_TODO.md)');
  section('—', 'Skipped ', tally.skipped);
  lines.push(`— Owned:    ${tally.owned.length} files`);

  return lines.join('\n');
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

  const cwd = process.cwd();
  const activePrompts = cli.yes ? buildAutoPrompts() : prompts;

  prompts.intro('appystack-upgrade');

  // -------------------------------------------------------------------------
  // 1. Resolve template directory
  // -------------------------------------------------------------------------
  let templateDir;
  try {
    templateDir = resolveTemplateDir(cli.templatePath ?? null);
  } catch (err) {
    prompts.cancel(err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // 2. Detect scaffold version info
  // -------------------------------------------------------------------------
  let scaffoldInfo = detectScaffoldInfo(cwd);
  let { version, scaffoldCommit, source } = scaffoldInfo;

  if (source === 'prompt') {
    // Ask user to supply the scaffold version
    const answer = await activePrompts.text({
      message: 'No scaffold record found. What version of AppyStack was used to scaffold this app?',
      placeholder: '0.3.0',
      initialValue: '0.3.0',
    });

    if (activePrompts.isCancel(answer)) {
      prompts.cancel('Cancelled');
      process.exit(0);
    }

    version = answer || '0.3.0';
    scaffoldCommit = null;
    writeAppystackJson(cwd, { version, scaffoldCommit });
  } else if (source === 'git') {
    prompts.note(
      `Scaffold commit detected: ${scaffoldCommit} (version inferred as ${version})`,
      'Scaffold info'
    );
    writeAppystackJson(cwd, { version, scaffoldCommit });
  } else {
    // source === 'file'
    prompts.note(
      `Found appystack.json — version ${version}, scaffold commit ${scaffoldCommit ?? '(none)'}`,
      'Scaffold info'
    );
  }

  // -------------------------------------------------------------------------
  // 3. Walk template files
  // -------------------------------------------------------------------------
  const templateFiles = walkTemplateFiles(templateDir);
  prompts.note(`${templateFiles.length} template files found`, 'Template');

  // -------------------------------------------------------------------------
  // 4. Classify and process each file
  // -------------------------------------------------------------------------
  const results = [];

  for (const relativePath of templateFiles) {
    const tier = classifyFile(relativePath);

    if (tier === 'never') {
      results.push({ action: 'owned', path: relativePath });
      continue;
    }

    if (tier === 'auto') {
      const result = await handleAutoFile(cwd, templateDir, scaffoldCommit, relativePath, activePrompts);
      results.push(result);
      continue;
    }

    if (tier === 'recipe') {
      const result = await handleRecipeFile(cwd, templateDir, scaffoldCommit, relativePath, activePrompts, diffModule);
      results.push(result);
      continue;
    }
  }

  // -------------------------------------------------------------------------
  // 5. Update appystack.json with lastUpgrade = today
  // -------------------------------------------------------------------------
  writeAppystackJson(cwd, { version, scaffoldCommit });

  // -------------------------------------------------------------------------
  // 6. Print summary
  // -------------------------------------------------------------------------
  const tally = tallySummary(results);
  prompts.note(formatSummary(tally), 'Summary');

  prompts.outro('Upgrade complete');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
