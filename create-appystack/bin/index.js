#!/usr/bin/env node
/**
 * create-appystack CLI
 * Usage: npx create-appystack [project-name]
 */
import { intro, outro, text, cancel, isCancel, spinner } from '@clack/prompts';
import { readFileSync, writeFileSync, cpSync, existsSync, rmSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = resolve(__dirname, '../template');

function readFile(root, relPath) {
  return readFileSync(resolve(root, relPath), 'utf-8');
}

function writeFile(root, relPath, content) {
  writeFileSync(resolve(root, relPath), content, 'utf-8');
}

function replaceAll(content, from, to) {
  return content.split(from).join(to);
}

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
  envExample = replaceAll(
    envExample,
    `CLIENT_URL=http://localhost:${oldClientPort}`,
    `CLIENT_URL=http://localhost:${clientPort}`
  );
  writeFile(root, '.env.example', envExample);

  // server/src/config/env.ts
  let envTs = readFile(root, 'server/src/config/env.ts');
  envTs = replaceAll(
    envTs,
    `PORT: z.coerce.number().default(${oldServerPort})`,
    `PORT: z.coerce.number().default(${serverPort})`
  );
  envTs = replaceAll(
    envTs,
    `CLIENT_URL: z.string().default('http://localhost:${oldClientPort}')`,
    `CLIENT_URL: z.string().default('http://localhost:${clientPort}')`
  );
  writeFile(root, 'server/src/config/env.ts', envTs);

  // client/vite.config.ts
  let viteConfig = readFile(root, 'client/vite.config.ts');
  viteConfig = replaceAll(viteConfig, `port: ${oldClientPort}`, `port: ${clientPort}`);
  viteConfig = replaceAll(
    viteConfig,
    `target: 'http://localhost:${oldServerPort}'`,
    `target: 'http://localhost:${serverPort}'`
  );
  writeFile(root, 'client/vite.config.ts', viteConfig);

  // client/index.html
  let indexHtml = readFile(root, 'client/index.html');
  indexHtml = replaceAll(indexHtml, `<title>${oldTitle}</title>`, `<title>${name}</title>`);
  writeFile(root, 'client/index.html', indexHtml);
}

async function main() {
  const argName = process.argv[2];

  intro('create-appystack');

  // --- Project name ---
  let projectName;
  if (argName) {
    if (!/^[a-z0-9-]+$/.test(argName.trim())) {
      console.error('Error: project name must use lowercase letters, numbers, and hyphens only');
      process.exit(1);
    }
    projectName = argName.trim();
  } else {
    const result = await text({
      message: 'Project name (e.g. my-app)',
      placeholder: 'my-app',
      validate(value) {
        if (!value || value.trim().length === 0) return 'Project name is required';
        if (!/^[a-z0-9-]+$/.test(value.trim()))
          return 'Use lowercase letters, numbers, and hyphens only';
      },
    });
    if (isCancel(result)) { cancel('Cancelled.'); process.exit(0); }
    projectName = result.trim();
  }

  // --- Check target doesn't exist ---
  const targetDir = resolve(process.cwd(), projectName);
  if (existsSync(targetDir)) {
    console.error(`Error: directory "${projectName}" already exists`);
    process.exit(1);
  }

  // --- Package scope ---
  const scopeResult = await text({
    message: 'Package scope (e.g. @myorg)',
    placeholder: '@myorg',
    validate(value) {
      if (!value || value.trim().length === 0) return 'Package scope is required';
      if (!value.trim().startsWith('@')) return 'Scope must start with @';
      if (!/^@[a-z0-9-]+$/.test(value.trim())) return 'Use @lowercase-letters-numbers-hyphens only';
    },
  });
  if (isCancel(scopeResult)) { cancel('Cancelled.'); process.exit(0); }
  const packageScope = scopeResult.trim();

  // --- Client port ---
  const clientPortResult = await text({
    message: 'Client port',
    placeholder: '5500',
    initialValue: '5500',
    validate(value) {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        return 'Enter a valid port number (1–65535)';
    },
  });
  if (isCancel(clientPortResult)) { cancel('Cancelled.'); process.exit(0); }
  const clientPort = clientPortResult.trim();

  // --- Server port (defaults to client port + 1) ---
  const serverPortResult = await text({
    message: 'Server port',
    placeholder: String(Number(clientPort) + 1),
    initialValue: String(Number(clientPort) + 1),
    validate(value) {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 1 || port > 65535)
        return 'Enter a valid port number (1–65535)';
    },
  });
  if (isCancel(serverPortResult)) { cancel('Cancelled.'); process.exit(0); }
  const serverPort = serverPortResult.trim();

  // --- Description ---
  const descResult = await text({
    message: 'Project description',
    placeholder: 'My awesome app',
    validate(value) {
      if (!value || value.trim().length === 0) return 'Description is required';
    },
  });
  if (isCancel(descResult)) { cancel('Cancelled.'); process.exit(0); }
  const description = descResult.trim();

  // --- Copy template ---
  const s = spinner();
  s.start('Copying template...');
  try {
    cpSync(TEMPLATE_DIR, targetDir, { recursive: true, filter: templateFilter });
    s.stop('Template copied');
  } catch (err) {
    s.stop('Failed to copy template');
    console.error(err.message);
    rmSync(targetDir, { recursive: true, force: true });
    process.exit(1);
  }

  // --- Apply customizations ---
  s.start('Customizing project...');
  try {
    applyCustomizations(targetDir, {
      name: projectName,
      scope: packageScope,
      serverPort,
      clientPort,
      desc: description,
    });
    s.stop('Project customized');
  } catch (err) {
    s.stop('Customization failed');
    console.error(err.message);
    rmSync(targetDir, { recursive: true, force: true });
    process.exit(1);
  }

  // --- npm install ---
  s.start('Installing dependencies (this may take a minute)...');
  try {
    execSync('npm install', { cwd: targetDir, stdio: 'inherit' });
    s.stop('Dependencies installed');
  } catch (err) {
    s.stop('npm install failed');
    console.error('Run "npm install" manually after cd into the project.');
  }

  outro(`Created ${projectName}

Next steps:
  cd ${projectName}
  npm run dev

Client: http://localhost:${clientPort}
Server: http://localhost:${serverPort}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
