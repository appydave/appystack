# vendor/

Vendored tarball of `@appydave/core` 0.2.0, the first version on zod 4. It stands in for the
npm range until 0.2.0 is published.

- `appydave-core-0.2.0-1cd0e79.tgz`: built from `appydave-foundation` branch `core-0.2.0-zod4` @ `1cd0e79`.
  `zod` is a **peer dependency** (`^4.0.0`), so the server's own `zod` ^4 is the only copy.

**After the npm publish:** set `"@appydave/core": "^0.2.0"` in `server/package.json`, delete this
folder, then run `npm run sync` in `create-appystack/`.
