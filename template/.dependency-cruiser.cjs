// G11: no import cycles. Run per workspace with --ts-config (see the `deadcode` script):
// without it the tsconfig path aliases (@/, @hooks, @helpers ...) do not resolve and an alias cycle is missed.
module.exports = {
  forbidden: [{ name: 'no-circular', severity: 'error', from: {}, to: { circular: true } }],
  options: { doNotFollow: { path: 'node_modules' }, tsPreCompilationDeps: true },
};
