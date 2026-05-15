# Vendored prisma-next snapshot

A snapshot of the browser-safe `@prisma-next/*` packages, refreshed
from a sibling `prisma-next` clone via
`website/scripts/vendor-prisma-next.ts`. Lives here because:

1. `prisma-next` isn't on npm yet, but the playground demo at
   `website/playground-examples/prisma-next-plugin/` needs the runtime
   to load entirely in the browser.
2. Without a vendored copy, the docs site can't build in CI / on
   contributor machines that don't have the sibling clone checked out.

The hand-written sibling `driver-sqlite/` is **not** part of the
snapshot — it's a sql.js-backed shim that replaces the upstream
`node:sqlite`-based driver. Preserved across refreshes.

## Refresh

```sh
# from repo root, with `../prisma-next` checked out and built
pnpm --filter @pothos/website tsx scripts/vendor-prisma-next.ts
pnpm install
```

Then commit the result. `manifest.json` records the source SHA and
timestamp.

## Removal

When prisma-next publishes to npm, delete `website/vendor/prisma-next/`
(except `driver-sqlite/` if browser support still requires it), drop
the workspace glob from `pnpm-workspace.yaml`, and pin real npm
versions in `website/package.json`. The `_publishGate` note in
`packages/plugin-prisma-next/package.json` tracks the same flag.
