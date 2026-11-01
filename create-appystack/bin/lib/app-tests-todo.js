// A 0.4.x scaffold with custom ports shipped a server env.test.ts that still expects the template defaults
// (5501 / 5500) while its env.ts holds the app's ports, so the app's own test fails before and after the upgrade.
// env.test.ts is app-owned (never tier): write a row naming the exact lines to change instead of editing it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendUpgradeTodo } from './diff.js';

const ENV_TS = 'server/src/config/env.ts';
const ENV_TEST = 'server/src/config/env.test.ts';
const TEMPLATE_PORT = '5501';
const TEMPLATE_CLIENT_PORT = '5500';

const defaultPort = (text) => /PORT:\s*z\.coerce\.number\(\)\.default\((\d+)\)/.exec(text)?.[1];
const defaultClientPort = (text) =>
  /CLIENT_URL:\s*z\.string\(\)\.default\('http:\/\/localhost:(\d+)'\)/.exec(text)?.[1];

// Returns true when it wrote at least one row.
export function appendEnvTestTodo(consumerDir) {
  const envPath = join(consumerDir, ENV_TS);
  const testPath = join(consumerDir, ENV_TEST);
  if (!existsSync(envPath) || !existsSync(testPath)) return false;
  const env = readFileSync(envPath, 'utf-8');
  const test = readFileSync(testPath, 'utf-8');

  const fixes = [];
  const port = defaultPort(env);
  if (port && port !== TEMPLATE_PORT && test.includes(`expect(env.PORT).toBe(${TEMPLATE_PORT})`)) {
    fixes.push(`\`expect(env.PORT).toBe(${TEMPLATE_PORT})\` to \`toBe(${port})\``);
  }
  const clientPort = defaultClientPort(env);
  const clientLine = `expect(env.CLIENT_URL).toBe('http://localhost:${TEMPLATE_CLIENT_PORT}')`;
  if (clientPort && clientPort !== TEMPLATE_CLIENT_PORT && test.includes(clientLine)) {
    fixes.push(`\`${clientLine}\` to \`http://localhost:${clientPort}\``);
  }
  if (fixes.length === 0) return false;

  appendUpgradeTodo(
    consumerDir,
    ENV_TEST,
    `Fails before and after the upgrade: it still expects the template default ports but \`env.ts\` holds yours. Change ${fixes.join(' and ')}`,
  );
  return true;
}
