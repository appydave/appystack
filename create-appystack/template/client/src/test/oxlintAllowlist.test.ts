import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The Oxlint config is JSON with // comments: drop whole-line comments, then parse.
// vitest runs with the client workspace as cwd; the config sits one level up, at the template root.
const configPath = resolve(process.cwd(), '../.oxlintrc.json');
const config: unknown = JSON.parse(readFileSync(configPath, 'utf8').replace(/^\s*\/\/.*$/gm, ''));

describe('Oxlint config', () => {
  // The whole file is pinned, not just rules/overrides: widening ignorePatterns or dropping a
  // plugin silently switches the gate off for files or rules. Any change must edit this test too.
  it('is exactly the reviewed config: three type-lie rules at error, one allowlisted file, nothing ignored but build output', () => {
    expect(config).toEqual({
      $schema: './node_modules/oxlint/configuration_schema.json',
      plugins: ['typescript', 'react'],
      ignorePatterns: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
      rules: {
        'typescript/no-explicit-any': 'error',
        'typescript/no-non-null-assertion': 'error',
        'typescript/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      },
      overrides: [
        {
          files: ['client/src/utils/api.ts'],
          rules: { 'typescript/consistent-type-assertions': 'off' },
        },
      ],
    });
  });
});
