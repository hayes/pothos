import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// `@prisma-next/*` now resolves to the published npm packages (0.14.0).
// The sole alias we still need is `@prisma-next/driver-sqlite`: its
// upstream build targets Node's `node:sqlite`, which doesn't exist in
// the browser. The playground's `prisma-next-bundle.ts` (and the npm
// `@prisma-next/sqlite` package it bundles, which imports
// `@prisma-next/driver-sqlite/runtime` internally) must instead reach
// the hand-written sql.js-backed shim under
// `lib/playground/prisma-next/driver-sqlite/`. That shim also provides
// the `/seed` registry the demo `db.ts` files import — an export the
// upstream package doesn't ship.
// Turbopack's resolveAlias rejects absolute paths with a leading `/`
// (treated as server-relative), so use the `./` root-relative form, and
// map each subpath explicitly (Turbopack doesn't expand directory
// aliases for subpath specifiers).
const turbopackResolveAlias = {
  '@prisma-next/driver-sqlite/runtime': './lib/playground/prisma-next/driver-sqlite/runtime.mjs',
  '@prisma-next/driver-sqlite/seed': './lib/playground/prisma-next/driver-sqlite/seed.mjs',
};

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Workspace packages aren't transpiled by Next/Turbopack by default;
  // listing the prisma-next plugin ensures its pre-built esm/ gets
  // re-processed so the driver-sqlite alias above is applied to the bare
  // `@prisma-next/driver-sqlite/*` imports inside it.
  transpilePackages: ['@pothos/plugin-prisma-next'],
  turbopack: {
    resolveAlias: turbopackResolveAlias,
  },
  rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
};

export default withMDX(config);
