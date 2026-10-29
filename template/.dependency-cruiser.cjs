/**
 * G11 (cycles) and G12 (boundaries). Every layer rule is `reachable: true`, so a layer cannot reach a
 * forbidden one through an intermediate module either. These are the generic workspace rules; an app adds
 * its own client layer rules here as it grows (see AppyRig's .dependency-cruiser.cjs for the shape).
 * Production code is src/ minus tests and test support.
 */
const PRODUCTION = {
  path: '^(client|server|shared)/src/',
  pathNot: ['\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)test/'],
};

module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment:
        'Two modules that import each other (directly or through others) cannot be loaded or tested alone. Move what both need into a third module that neither of them imports from. Type-only and dynamic imports do not count.',
      severity: 'error',
      from: {},
      to: {
        circular: true,
        viaOnly: { dependencyTypesNot: ['type-only', 'pre-compilation-only', 'dynamic-import'] },
      },
    },
    {
      name: 'client-not-server',
      comment:
        'The browser app never loads server code, directly or through another module. Put what both need in shared/ and import it from there.',
      severity: 'error',
      from: { path: '^client/' },
      to: { path: '^server/', reachable: true },
    },
    {
      name: 'server-not-client',
      comment:
        'The server never loads client code, directly or through another module. Put what both need in shared/ and import it from there.',
      severity: 'error',
      from: { path: '^server/' },
      to: { path: '^client/', reachable: true },
    },
    {
      name: 'shared-imports-nothing-local',
      comment:
        'shared/ is the bottom layer: it never loads server or client code, directly or through another module. Move the code it needs down into shared/.',
      severity: 'error',
      from: { path: '^shared/' },
      to: { path: '^(server|client)/', reachable: true },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'Production code cannot import a devDependency: it would be missing in a production install. Move the package to dependencies, or keep the import in a test.',
      severity: 'error',
      from: PRODUCTION,
      to: {
        dependencyTypes: ['npm-dev'],
        dependencyTypesNot: ['type-only', 'pre-compilation-only'],
      },
    },
    {
      name: 'not-to-spec',
      comment:
        'Production code cannot import a test, a test helper or a fixture. Move what it needs out of the test folder into the code that uses it.',
      severity: 'error',
      from: PRODUCTION,
      to: { path: ['\\.(test|spec)\\.[cm]?[jt]sx?$', '(^|/)test/', '^(e2e|lint)/'] },
    },
    {
      name: 'no-deprecated-core',
      comment:
        'This module depends on a node core module that has been deprecated. Use its replacement (for example the URL class instead of punycode).',
      severity: 'error',
      from: {},
      to: {
        dependencyTypes: ['core'],
        path: '^(?:punycode|domain|constants|sys|_linklist|_stream_wrap)$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)dist/' },
    // Resolves the @client/@server/@shared aliases, so the boundary rules still see aliased imports.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: 'specify',
    combinedDependencies: true,
  },
};
