import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

// vitest runs with the client workspace as cwd; .github sits one level up, at the template root.
const ci = readFileSync(resolve(process.cwd(), '..', '.github/workflows/ci.yml'), 'utf8');

// One entry per step (the first also holds the file head, the last of the first job also holds the
// second job's header): every line, trimmed, joined with ' ; '. Dropping, adding, changing or
// reordering any line, such as 'continue-on-error: true' or 'if: false', changes the list.
const STEPS = [
  'name: CI ; on: ; push: ; branches: [main] ; pull_request: ; branches: [main] ; jobs: ; ci: ; name: Format, typecheck, lint, test, coverage ; runs-on: ubuntu-latest ; steps:',
  'uses: actions/checkout@v4',
  'uses: actions/setup-node@v4 ; with: ; node-version: 24 ; cache: npm',
  'name: Install dependencies ; run: npm install',
  'name: Build shared ; run: npm run build --workspace=shared',
  'name: Format ; run: npm run format:check',
  'name: Typecheck ; run: npm run typecheck',
  'name: Lint ; run: npm run lint',
  'name: Duplicates ; run: npm run dup',
  'name: Dead code and import cycles ; run: npm run deadcode',
  'name: Test ; run: npm test',
  'name: Coverage thresholds (server, client) ; run: npm run test:coverage ; e2e: ; name: Browser tests ; runs-on: ubuntu-latest ; timeout-minutes: 20 ; steps:',
  'uses: actions/checkout@v4',
  'uses: actions/setup-node@v4 ; with: ; node-version: 24 ; cache: npm',
  'name: Install dependencies ; run: npm install',
  'name: Build shared ; run: npm run build --workspace=shared',
  'name: Install the browser ; run: npx playwright install --with-deps chromium',
  'name: Playwright (starts its own server and client) ; run: npm run test:e2e',
  'name: Keep the failure traces ; if: failure() ; uses: actions/upload-artifact@v4 ; with: ; name: playwright-test-results ; path: test-results/ ; if-no-files-found: ignore',
];
const actual = ci.split('\n      - ').map((part) =>
  part
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ; ')
);

it('ci.yml is exactly the reviewed workflow: no CI step added, dropped, changed or switched off', () => {
  expect(
    actual,
    'ci.yml no longer matches this pin. A CI step may not be altered without editing STEPS in this test in the same change: if the edit is deliberate (a scaffolded app with its own CI), update STEPS to match; if not, restore the step.'
  ).toEqual(STEPS);
});
