import { readdirSync } from 'node:fs';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// @prisma-next/* must resolve to the workspace-registered vendor copy
// regardless of where the import comes from (the prisma-next plugin's
// own esm/ also imports these names). Without the alias, Turbopack
// walks node_modules from the importer and lands on `link:` symlinks
// to a sibling clone that isn't guaranteed to be present in CI / on
// contributor machines.
// Turbopack's resolveAlias rejects absolute paths with a leading `/`
// (treated as server-relative), so use the `./` root-relative form.
const turbopackResolveAlias = Object.fromEntries(
  readdirSync(new URL('./vendor/prisma-next/', import.meta.url), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => [`@prisma-next/${d.name}`, `./vendor/prisma-next/${d.name}`]),
);

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  // Workspace packages aren't transpiled by Next/Turbopack by default;
  // listing the prisma-next plugin ensures its pre-built esm/ gets
  // re-processed with the alias above applied (otherwise the
  // bare `@prisma-next/*` imports in its esm/ stay unresolved).
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
