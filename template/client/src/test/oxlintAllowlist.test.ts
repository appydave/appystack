import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Oxlint config is JSON with // comments: drop whole-line comments, then parse.
// vitest runs with the client workspace as cwd; the config sits one level up, at the template root.
const configPath = resolve(process.cwd(), '../.oxlintrc.json');
const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\s*\/\/.*$/gm, ''));

describe('Oxlint allowlist', () => {
  it('turns off consistent-type-assertions for exactly one file: client/src/utils/api.ts', () => {
    expect(config.overrides).toEqual([
      {
        files: ['client/src/utils/api.ts'],
        rules: { 'typescript/consistent-type-assertions': 'off' },
      },
    ]);
  });

  it('keeps the three type-lie rules at error, with casts forbidden outright', () => {
    expect(config.rules).toEqual({
      'typescript/no-explicit-any': 'error',
      'typescript/no-non-null-assertion': 'error',
      'typescript/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
    });
  });
});
