import { intro, outro, text, cancel, isCancel } from '@clack/prompts';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function readFile(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), 'utf-8');
}

function writeFile(relPath: string, content: string): void {
  writeFileSync(resolve(ROOT, relPath), content, 'utf-8');
}

function replaceAll(content: string, from: string, to: string): string {
  return content.split(from).join(to);
}

type TextOptions = Parameters<typeof text>[0];

interface Answers {
  name: string;
  scope: string;
  serverPort: string;
  clientPort: string;
  desc: string;
}

interface FileEdit {
  file: string;
  replacements: Array<[from: string, to: string]>;
}

/** Ask one question; a cancelled prompt ends the script. Returns the trimmed answer. */
async function ask(options: TextOptions): Promise<string> {
  const answer = await text(options);

  if (isCancel(answer)) {
    cancel('Customization cancelled.');
    process.exit(0);
  }

  return answer.trim();
}

function validatePort(value: string | undefined): string | undefined {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return 'Enter a valid port number (1–65535)';
  }

  return undefined;
}

function validateProjectName(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Project name is required';
  }

  if (!/^[a-z0-9-]+$/.test(value.trim())) {
    return 'Use lowercase letters, numbers, and hyphens only';
  }

  return undefined;
}

function validateScope(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Package scope is required';
  }

  if (!value.trim().startsWith('@')) {
    return 'Scope must start with @';
  }

  if (!/^@[a-z0-9-]+$/.test(value.trim())) {
    return 'Use @lowercase-letters-numbers-hyphens only';
  }

  return undefined;
}

function validateDescription(value: string | undefined): string | undefined {
  if (!value || value.trim().length === 0) {
    return 'Description is required';
  }

  return undefined;
}

async function askAnswers(): Promise<Answers> {
  const name = await ask({
    message: 'Project name (e.g. my-app)',
    placeholder: 'my-app',
    validate: validateProjectName,
  });
  const scope = await ask({
    message: 'Package scope (e.g. @myorg)',
    placeholder: '@myorg',
    validate: validateScope,
  });
  const serverPort = await ask({
    message: 'Server port',
    placeholder: '5501',
    initialValue: '5501',
    validate: validatePort,
  });
  const clientPort = await ask({
    message: 'Client port',
    placeholder: '5500',
    initialValue: '5500',
    validate: validatePort,
  });
  const desc = await ask({
    message: 'Project description',
    placeholder: 'My awesome app',
    validate: validateDescription,
  });

  return { name, scope, serverPort, clientPort, desc };
}

const OLD_SCOPE = '@appystack-template';
const OLD_ROOT_NAME = '@appydave/appystack-template';
const OLD_SERVER_PORT = '5501';
const OLD_CLIENT_PORT = '5500';
const OLD_TITLE = 'AppyStack Template';
const OLD_DESCRIPTION = 'RVETS stack boilerplate (React, Vite, Express, TypeScript, Socket.io)';

/** The template's placeholder values, and what each file swaps them for. */
function buildEdits({ name, scope, serverPort, clientPort, desc }: Answers): FileEdit[] {
  return [
    {
      file: 'package.json',
      replacements: [
        [OLD_ROOT_NAME, `${scope}/${name}`],
        [OLD_DESCRIPTION, desc],
      ],
    },
    { file: 'shared/package.json', replacements: [[OLD_SCOPE, scope]] },
    { file: 'server/package.json', replacements: [[OLD_SCOPE, scope]] },
    { file: 'client/package.json', replacements: [[OLD_SCOPE, scope]] },
    {
      file: '.env.example',
      replacements: [
        [`PORT=${OLD_SERVER_PORT}`, `PORT=${serverPort}`],
        [
          `CLIENT_URL=http://localhost:${OLD_CLIENT_PORT}`,
          `CLIENT_URL=http://localhost:${clientPort}`,
        ],
      ],
    },
    {
      file: 'server/src/config/env.ts',
      replacements: [
        [
          `PORT: z.coerce.number().default(${OLD_SERVER_PORT})`,
          `PORT: z.coerce.number().default(${serverPort})`,
        ],
        [
          `CLIENT_URL: z.string().default('http://localhost:${OLD_CLIENT_PORT}')`,
          `CLIENT_URL: z.string().default('http://localhost:${clientPort}')`,
        ],
      ],
    },
    {
      file: 'client/vite.config.ts',
      replacements: [
        [`port: ${OLD_CLIENT_PORT}`, `port: ${clientPort}`],
        [
          `target: 'http://localhost:${OLD_SERVER_PORT}'`,
          `target: 'http://localhost:${serverPort}'`,
        ],
      ],
    },
    {
      file: 'client/index.html',
      replacements: [[`<title>${OLD_TITLE}</title>`, `<title>${name}</title>`]],
    },
    {
      file: 'scripts/start.sh',
      replacements: [
        [`:${OLD_SERVER_PORT}`, `:${serverPort}`],
        [`localhost:${OLD_CLIENT_PORT}`, `localhost:${clientPort}`],
        [
          `client: ${OLD_CLIENT_PORT}, server: ${OLD_SERVER_PORT}`,
          `client: ${clientPort}, server: ${serverPort}`,
        ],
        [`ports ${OLD_CLIENT_PORT}/${OLD_SERVER_PORT}`, `ports ${clientPort}/${serverPort}`],
        [OLD_TITLE, name],
      ],
    },
  ];
}

function applyEdits(edits: FileEdit[]): void {
  for (const { file, replacements } of edits) {
    const updated = replacements.reduce(
      (content, [from, to]) => replaceAll(content, from, to),
      readFile(file)
    );

    writeFile(file, updated);
  }
}

async function main(): Promise<void> {
  intro('AppyStack Template Customization');

  const answers = await askAnswers();

  applyEdits(buildEdits(answers));

  outro(
    `Done! Project customized as "${answers.scope}/${answers.name}". Run "npm install" to update the workspace symlinks.`
  );
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
