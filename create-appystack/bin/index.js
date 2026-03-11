#!/usr/bin/env node
/**
 * create-appystack CLI
 * Usage: npx create-appystack [project-name] [flags]
 *
 * Flags:
 *   --scope        Package scope, e.g. @appydave
 *   --port         Client port number
 *   --server-port  Server port number
 *   --description  One-line project description
 *   --github-org   GitHub org or user to create the repo under
 *   --public       Make the GitHub repo public (default: private)
 *   --no-github    Skip GitHub repo creation entirely
 */
import { intro, outro, text, select, confirm, cancel, isCancel, spinner, note } from '@clack/prompts';
import { readFileSync, writeFileSync, cpSync, existsSync, rmSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { buildAudit, renderAudit } from './audit.js';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, '../template');
const PKG_VERSION = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8')).version;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readFile(root, relPath) {
  return readFileSync(resolve(root, relPath), 'utf-8');
}

function writeFile(root, relPath, content) {
  writeFileSync(resolve(root, relPath), content, 'utf-8');
}

function replaceAll(content, from, to) {
  return content.split(from).join(to);
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const conn = createConnection({ port: Number(port), host: '127.0.0.1' });
    conn.on('connect', () => { conn.destroy(); resolve(true); });
    conn.on('error', () => resolve(false));
  });
}

function hasGhCli() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function tryExec(cmd, opts = {}) {
  try {
    const stdout = execSync(cmd, { stdio: 'pipe', ...opts }).toString();
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, message: err.message, stdout: null };
  }
}

// ---------------------------------------------------------------------------
// Template customisation
// ---------------------------------------------------------------------------

const EXCLUDE = new Set(['node_modules', 'dist', 'coverage', 'test-results', '.git']);

function templateFilter(src) {
  const segment = src.split('/').pop();
  return !EXCLUDE.has(segment);
}

function applyCustomizations(root, { name, scope, serverPort, clientPort, desc }) {
  const oldScope = '@appystack-template';
  const oldRootName = '@appydave/appystack-template';
  const oldServerPort = '5501';
  const oldClientPort = '5500';
  const oldTitle = 'AppyStack Template';
  const oldDescription = 'RVETS stack boilerplate (React, Vite, Express, TypeScript, Socket.io)';

  // Root package.json
  let rootPkg = readFile(root, 'package.json');
  rootPkg = replaceAll(rootPkg, oldRootName, `${scope}/${name}`);
  rootPkg = replaceAll(rootPkg, oldDescription, desc);
  writeFile(root, 'package.json', rootPkg);

  // shared/package.json
  let sharedPkg = readFile(root, 'shared/package.json');
  sharedPkg = replaceAll(sharedPkg, oldScope, scope);
  writeFile(root, 'shared/package.json', sharedPkg);

  // server/package.json
  let serverPkg = readFile(root, 'server/package.json');
  serverPkg = replaceAll(serverPkg, oldScope, scope);
  writeFile(root, 'server/package.json', serverPkg);

  // client/package.json
  let clientPkg = readFile(root, 'client/package.json');
  clientPkg = replaceAll(clientPkg, oldScope, scope);
  writeFile(root, 'client/package.json', clientPkg);

  // .env.example
  let envExample = readFile(root, '.env.example');
  envExample = replaceAll(envExample, `PORT=${oldServerPort}`, `PORT=${serverPort}`);
  envExample = replaceAll(envExample, `CLIENT_URL=http://localhost:${oldClientPort}`, `CLIENT_URL=http://localhost:${clientPort}`);
  writeFile(root, '.env.example', envExample);

  // server/src/config/env.ts
  let envTs = readFile(root, 'server/src/config/env.ts');
  envTs = replaceAll(envTs, `PORT: z.coerce.number().default(${oldServerPort})`, `PORT: z.coerce.number().default(${serverPort})`);
  envTs = replaceAll(envTs, `CLIENT_URL: z.string().default('http://localhost:${oldClientPort}')`, `CLIENT_URL: z.string().default('http://localhost:${clientPort}')`);
  writeFile(root, 'server/src/config/env.ts', envTs);

  // client/vite.config.ts
  let viteConfig = readFile(root, 'client/vite.config.ts');
  viteConfig = replaceAll(viteConfig, `port: ${oldClientPort}`, `port: ${clientPort}`);
  viteConfig = replaceAll(viteConfig, `target: 'http://localhost:${oldServerPort}'`, `target: 'http://localhost:${serverPort}'`);
  writeFile(root, 'client/vite.config.ts', viteConfig);

  // client/index.html
  let indexHtml = readFile(root, 'client/index.html');
  indexHtml = replaceAll(indexHtml, `<title>${oldTitle}</title>`, `<title>${name}</title>`);
  writeFile(root, 'client/index.html', indexHtml);

  // README.md
  let readme = readFile(root, 'README.md');
  readme = replaceAll(readme, '# [App Name]', `# ${name}`);
  readme = replaceAll(readme, '> One line describing what this app is. Replace this.', `> ${desc}`);
  readme = replaceAll(readme, `port ${oldClientPort}`, `port ${clientPort}`);
  readme = replaceAll(readme, `port ${oldServerPort}`, `port ${serverPort}`);
  readme = replaceAll(readme, `localhost:${oldClientPort}`, `localhost:${clientPort}`);
  readme = replaceAll(readme, `localhost:${oldServerPort}`, `localhost:${serverPort}`);
  readme = replaceAll(readme, `| Client (Vite)    | ${oldClientPort}`, `| Client (Vite)    | ${clientPort}`);
  readme = replaceAll(readme, `| Server (Express) | ${oldServerPort}`, `| Server (Express) | ${serverPort}`);
  writeFile(root, 'README.md', readme);

  // All .ts / .tsx source files — replace remaining scope references in imports
  function walkAndReplace(dir) {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walkAndReplace(full);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        const content = readFileSync(full, 'utf-8');
        if (content.includes(oldScope)) {
          writeFileSync(full, replaceAll(content, oldScope, scope), 'utf-8');
        }
      }
    }
  }
  walkAndReplace(root);
}

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = {};
  let name = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1])       { flags.scope = args[++i]; }
    else if (args[i] === '--port' && args[i + 1])   { flags.port = args[++i]; }
    else if (args[i] === '--server-port' && args[i + 1]) { flags.serverPort = args[++i]; }
    else if (args[i] === '--description' && args[i + 1]) { flags.description = args[++i]; }
    else if (args[i] === '--github-org' && args[i + 1]) { flags.githubOrg = args[++i]; }
    else if (args[i] === '--public')                { flags.public = true; }
    else if (args[i] === '--no-github')             { flags.noGithub = true; }
    else if (!args[i].startsWith('--') && !name)   { name = args[i]; }
  }
  return { name, ...flags };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseArgs();
  const ghAvailable = !cli.noGithub && hasGhCli();

  intro('create-appystack');

  // --- Project name ---
  let projectName;
  if (cli.name) {
    if (!/^[a-z0-9-]+$/.test(cli.name.trim())) {
      console.error('Error: project name must use lowercase letters, numbers, and hyphens only');
      process.exit(1);
    }
    projectName = cli.name.trim();
  } else {
    const result = await text({
      message: 'Project name',
      placeholder: 'my-app',
      validate(value) {
        if (!value || value.trim().length === 0) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value.trim())) return 'Use lowercase letters, numbers, and hyphens only';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    projectName = result.trim();
  }

  // --- Check target directory ---
  const targetDir = resolve(process.cwd(), projectName);
  let mergeMode = false;
  if (existsSync(targetDir)) {
    const doMerge = await confirm({
      message: `Directory "${projectName}" already exists. Scaffold into it (keeps existing files)?`,
    });
    if (isCancel(doMerge) || !doMerge) { cancel('Cancelled.'); process.exit(0); }
    mergeMode = true;
  }

  // --- Package scope ---
  let packageScope;
  if (cli.scope) {
    const s = cli.scope.trim();
    if (!s.startsWith('@') || !/^@[a-z0-9-]+$/.test(s)) {
      console.error('Error: --scope must be like @myorg');
      process.exit(1);
    }
    packageScope = s;
  } else {
    const result = await text({
      message: 'Package scope',
      placeholder: '@myorg',
      validate(value) {
        if (!value || value.trim().length === 0) return 'Package scope is required';
        if (!value.trim().startsWith('@')) return 'Scope must start with @';
        if (!/^@[a-z0-9-]+$/.test(value.trim())) return 'Use @lowercase-letters-numbers-hyphens only';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    packageScope = result.trim();
  }

  // --- Client port ---
  let clientPort;
  if (cli.port) {
    const p = Number(cli.port);
    if (!Number.isInteger(p) || p < 1 || p > 65534) {
      console.error('Error: --port must be a valid port number (1–65534)');
      process.exit(1);
    }
    clientPort = String(p);
  } else {
    const inUse = await isPortInUse(5500);
    const result = await text({
      message: 'Client port',
      placeholder: '5500',
      initialValue: '5500',
      hint: inUse ? '⚠ port 5500 appears to be in use' : undefined,
      validate(value) {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Enter a valid port number (1–65535)';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    clientPort = result.trim();
  }

  // Check chosen client port
  const clientPortInUse = await isPortInUse(Number(clientPort));

  // --- Server port ---
  let serverPort;
  const defaultServerPort = String(Number(clientPort) + 1);
  if (cli.serverPort) {
    const p = Number(cli.serverPort);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      console.error('Error: --server-port must be a valid port number (1–65535)');
      process.exit(1);
    }
    serverPort = String(p);
  } else {
    const inUse = await isPortInUse(Number(defaultServerPort));
    const result = await text({
      message: 'Server port',
      placeholder: defaultServerPort,
      initialValue: defaultServerPort,
      hint: inUse ? `⚠ port ${defaultServerPort} appears to be in use` : undefined,
      validate(value) {
        const port = Number(value);
        if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Enter a valid port number (1–65535)';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    serverPort = result.trim();
  }

  const serverPortInUse = await isPortInUse(Number(serverPort));

  // --- Description ---
  let description;
  if (cli.description) {
    description = cli.description.trim();
  } else {
    const result = await text({
      message: 'Project description',
      placeholder: 'A short one-liner describing what this app does',
      validate(value) {
        if (!value || value.trim().length === 0) return 'Description is required';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    description = result.trim();
  }

  // --- GitHub org/visibility ---
  let githubOrg = null;
  let visibility = 'private';

  if (ghAvailable) {
    if (cli.githubOrg) {
      githubOrg = cli.githubOrg.trim();
    } else {
      const result = await text({
        message: 'GitHub org or user (for repo creation)',
        placeholder: 'appydave',
        initialValue: 'appydave',
        hint: 'Leave blank to skip GitHub repo creation',
      });
      if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
      githubOrg = result.trim() || null;
    }

    if (githubOrg && !cli.public) {
      const result = await select({
        message: 'Repository visibility',
        options: [
          { value: 'private', label: 'Private', hint: 'only you and collaborators' },
          { value: 'public', label: 'Public', hint: 'visible to everyone' },
        ],
      });
      if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
      visibility = result;
    } else if (cli.public) {
      visibility = 'public';
    }
  }

  // --- Confirmation summary ---
  const portWarnings = [
    clientPortInUse ? `  ⚠  Client port ${clientPort} is currently in use` : '',
    serverPortInUse ? `  ⚠  Server port ${serverPort} is currently in use` : '',
  ].filter(Boolean).join('\n');

  const githubLine = githubOrg
    ? `  GitHub     github.com/${githubOrg}/${projectName} (${visibility})`
    : !ghAvailable && !cli.noGithub
    ? `  GitHub     skipped — gh CLI not found (install with: brew install gh)`
    : `  GitHub     skipped`;

  const modeLabel = mergeMode ? 'merge into existing' : 'create new';

  note(
    [
      `  Project    ${projectName}`,
      `  Mode       ${modeLabel}`,
      `  Scope      ${packageScope}`,
      `  Client     http://localhost:${clientPort}`,
      `  Server     http://localhost:${serverPort}`,
      githubLine,
      `  Location   ${targetDir}`,
      portWarnings ? '' : '',
      portWarnings,
    ].filter((l) => l !== undefined).join('\n').trim(),
    'Ready to scaffold'
  );

  // --- Merge mode audit ---
  if (mergeMode) {
    const audit = buildAudit(targetDir, TEMPLATE_DIR, templateFilter);
    note(renderAudit(audit, projectName, targetDir), 'File audit');
  }

  const go = await confirm({ message: mergeMode ? 'Scaffold into existing directory?' : 'Create project?' });
  if (isCancel(go) || !go) { cancel('Cancelled.'); process.exit(0); }

  // --- Copy template ---
  const s = spinner();
  s.start(mergeMode ? 'Merging template (existing files kept)...' : 'Copying template...');
  try {
    cpSync(TEMPLATE_DIR, targetDir, { recursive: true, filter: templateFilter, force: !mergeMode });
    s.stop(mergeMode ? 'Template merged' : 'Template copied');
  } catch (err) {
    s.stop('Failed to copy template');
    console.error(err.message);
    if (!mergeMode) rmSync(targetDir, { recursive: true, force: true });
    process.exit(1);
  }

  // --- Apply customizations ---
  s.start('Customising project...');
  try {
    applyCustomizations(targetDir, { name: projectName, scope: packageScope, serverPort, clientPort, desc: description });
    s.stop('Project customised');
  } catch (err) {
    s.stop('Customisation failed');
    console.error(err.message);
    if (!mergeMode) rmSync(targetDir, { recursive: true, force: true });
    process.exit(1);
  }

  // --- npm install ---
  s.start('Installing dependencies...');
  try {
    execSync('npm install', { cwd: targetDir, stdio: 'pipe' });
    s.stop('Dependencies installed');
  } catch (err) {
    s.stop('npm install failed — run it manually after cd into the project');
  }

  // --- Git init + initial commit ---
  const gitAlreadyExists = existsSync(resolve(targetDir, '.git'));
  s.start(gitAlreadyExists ? 'Adding scaffold files to existing git repo...' : 'Initialising git repository...');
  const gitCommitMsg = mergeMode
    ? 'chore: scaffold appystack into existing project'
    : 'chore: initial scaffold from create-appystack';
  const gitCmd = gitAlreadyExists
    ? `git add -A && git commit -m "${gitCommitMsg}"`
    : `git init && git add -A && git commit -m "${gitCommitMsg}"`;
  const gitResult = tryExec(gitCmd, { cwd: targetDir, shell: true });
  if (gitResult.ok) {
    s.stop(gitAlreadyExists ? 'Scaffold files committed' : 'Git repository initialised');
  } else {
    s.stop('Git step skipped — run "git add -A && git commit" manually');
  }

  // Write appystack.json — version baseline for npx appystack-upgrade
  if (gitResult.ok) {
    try {
      const shaResult = tryExec('git rev-parse HEAD', { cwd: targetDir, shell: true });
      const scaffoldCommit = shaResult.ok ? shaResult.stdout?.trim() ?? null : null;
      const appystackMeta = {
        version: PKG_VERSION,
        scaffoldCommit,
        lastUpgrade: null,
        templatePath: null,
      };
      writeFileSync(resolve(targetDir, 'appystack.json'), JSON.stringify(appystackMeta, null, 2) + '\n', 'utf-8');
    } catch {
      // non-fatal — appystack.json missing just means first upgrade run will prompt
    }
  }

  // --- GitHub repo creation ---
  let repoUrl = null;
  if (githubOrg && gitResult.ok) {
    s.start(`Creating GitHub repo ${githubOrg}/${projectName}...`);
    const ghResult = tryExec(
      `gh repo create ${githubOrg}/${projectName} --${visibility} --source=. --remote=origin --push`,
      { cwd: targetDir, shell: true }
    );
    if (ghResult.ok) {
      repoUrl = `https://github.com/${githubOrg}/${projectName}`;
      s.stop(`Repo created and pushed → ${repoUrl}`);
    } else {
      s.stop(`GitHub repo creation failed — create it manually at github.com/new`);
    }
  }

  // --- Outro ---
  const nextSteps = [
    `  cd ${projectName}`,
    `  npm run dev`,
    ``,
    `  Client  →  http://localhost:${clientPort}`,
    `  Server  →  http://localhost:${serverPort}`,
    repoUrl ? `  GitHub  →  ${repoUrl}` : '',
    ``,
    `  Next:`,
    `  • Delete client/src/demo/ when you start building`,
    `  • Run /recipe readme once you have something working`,
    `  • Run /recipe nav-shell or /recipe file-crud to scaffold features`,
  ].filter((l) => l !== null).join('\n');

  outro(`Created ${projectName}\n\n${nextSteps}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
