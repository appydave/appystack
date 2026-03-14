// WU04: classifyFile(relativePath) → 'auto' | 'never' | 'recipe'

export const CLASSIFICATION = {
  auto: [
    'server/src/middleware/errorHandler.ts',
    'server/src/middleware/rateLimiter.ts',
    'server/src/middleware/requestLogger.ts',
    'server/src/middleware/validate.ts',
    'server/src/config/logger.ts',
    'client/src/hooks/useSocket.ts',
    '.github/workflows/ci.yml',
    'eslint.config.js',
    'server/nodemon.json', // safe infrastructure config — consumers rarely customize, no project-specific values
    'Procfile', // process manager config — generic client/server split, safe to refresh
    'scripts/start.sh', // startup script — port-check + overmind launch, safe to refresh (ports come from env)
  ],
  neverPatterns: [
    // exact filenames (basename match)
    { type: 'basename', values: ['package.json', '.env', '.env.example', 'CLAUDE.md', 'README.md'] },
    // path prefixes
    { type: 'prefix', values: ['shared/src/', 'client/src/pages/', 'client/src/components/', 'client/src/demo/'] },
    // exact paths
    {
      type: 'exact',
      values: [
        'server/src/index.ts',
        'client/index.html',
        'client/vite.config.ts',
        'client/src/main.tsx',
        'client/src/App.tsx',
        'client/src/styles/index.css',
        // Project-specific values set at scaffold time (scope, ports) — never overwrite
        'server/src/config/env.ts',
        'server/src/routes/health.ts',
        'server/src/routes/info.ts',
        'client/src/lib/entitySocket.ts',
      ],
    },
    // suffix patterns
    { type: 'suffix', values: ['.json'] }, // catches tsconfig*.json via extension + name check below
  ],
  recipePrefix: '.claude/skills/recipe/',
};

const AUTO_SET = new Set(CLASSIFICATION.auto);

const NEVER_BASENAMES = new Set(['package.json', '.env', '.env.example', 'CLAUDE.md', 'README.md']);

const NEVER_PREFIXES = [
  'shared/src/',
  'client/src/pages/',
  'client/src/components/',
  'client/src/demo/',
];

const NEVER_EXACT = new Set([
  'server/src/index.ts',
  'client/index.html',
  'client/vite.config.ts',
  'client/src/main.tsx',
  'client/src/App.tsx',
  'client/src/styles/index.css',
  // Project-specific values set at scaffold time (scope, ports) — never overwrite
  'server/src/config/env.ts',
  'server/src/routes/health.ts',
  'server/src/routes/info.ts',
  'client/src/lib/entitySocket.ts',
]);

/**
 * Returns true if the path looks like a tsconfig*.json file (any directory depth).
 */
function isTsconfig(relativePath) {
  const basename = relativePath.split('/').pop();
  return basename.startsWith('tsconfig') && basename.endsWith('.json');
}

/**
 * Returns true if the path looks like a vitest.config.* file (any directory depth).
 */
function isVitestConfig(relativePath) {
  const basename = relativePath.split('/').pop();
  return basename.startsWith('vitest.config.');
}

/**
 * Classify a template file into one of three upgrade tiers.
 *
 * @param {string} relativePath - path relative to project root (forward slashes)
 * @returns {'auto' | 'never' | 'recipe'}
 */
export function classifyFile(relativePath) {
  // 1. Recipe — most specific, checked first
  if (relativePath.startsWith(CLASSIFICATION.recipePrefix)) {
    return 'recipe';
  }

  // 2. Auto allowlist — exact match only
  if (AUTO_SET.has(relativePath)) {
    return 'auto';
  }

  // 3. Never rules
  const basename = relativePath.split('/').pop();

  if (NEVER_BASENAMES.has(basename)) return 'never';
  if (NEVER_EXACT.has(relativePath)) return 'never';
  if (NEVER_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return 'never';
  if (isTsconfig(relativePath)) return 'never';
  if (isVitestConfig(relativePath)) return 'never';

  // 4. Default — unknown files are project-owned; do not overwrite
  return 'never';
}
