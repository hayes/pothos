import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// The ORM's runtime imports Node builtins the browser doesn't have, most notably `node:sqlite` for
// its driver. Replace only those modules, so every ORM package stays the published one.
const browserNodeModules = {
  'node:crypto': './lib/playground/prisma-next/node-crypto.ts',
  'node:fs/promises': './lib/playground/prisma-next/node-fs-promises.ts',
  'node:sqlite': './lib/playground/prisma-next/node-sqlite.ts',
};

// Allow browsers and well-behaved crawlers to cache the plain-text docs instead
// of re-downloading them on every visit (they only change on deploy).
const llmTextCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
];

// The workspace plugin and the website resolve different pnpm peer variants of the ORM (their
// TypeScript versions differ), and the ORM refuses to run with two copies loaded. Share one copy.
// Aliases to a file bypass package exports, so map each exported subpath to its file.
const ormAliases = Object.fromEntries(
  ['@prisma/orm-family-sql', '@prisma/orm-framework'].flatMap((name) => {
    const manifest = JSON.parse(readFileSync(`./node_modules/${name}/package.json`, 'utf8'));
    return Object.entries(manifest.exports)
      .filter(([, target]) => typeof target === 'string')
      .map(([subpath, target]) => [
        `${name}${subpath.slice(1)}`,
        `./node_modules/${name}/${target.slice(2)}`,
      ]);
  }),
);

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {
    resolveAlias: {
      ...Object.fromEntries(
        Object.entries(browserNodeModules).map(([name, file]) => [name, { browser: file }]),
      ),
      ...ormAliases,
    },
  },
  webpack(webpackConfig, { isServer, webpack }) {
    for (const [name, file] of Object.entries(ormAliases)) {
      webpackConfig.resolve.alias[`${name}$`] = fileURLToPath(new URL(file, import.meta.url));
    }
    if (!isServer) {
      webpackConfig.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:(crypto|fs\/promises|sqlite)$/,
          (resource) => {
            resource.request = fileURLToPath(
              new URL(browserNodeModules[resource.request], import.meta.url),
            );
          },
        ),
      );
    }
    return webpackConfig;
  },
  rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
  headers() {
    return [
      { source: '/llms.txt', headers: llmTextCacheHeaders },
      { source: '/llms-full.txt', headers: llmTextCacheHeaders },
      { source: '/llms.mdx/:path*', headers: llmTextCacheHeaders },
      { source: '/docs/:path*.mdx', headers: llmTextCacheHeaders },
    ];
  },
  redirects() {
    return [
      { source: '/docs/guide', destination: '/docs', permanent: true },
      { source: '/docs/guide.mdx', destination: '/docs.mdx', permanent: true },
      { source: '/llms.mdx/guide', destination: '/llms.mdx', permanent: true },
      // The marketing /plugins route was consolidated into the canonical docs
      // catalog at /docs/plugins (same component, one URL). Redirect the old URL.
      { source: '/plugins', destination: '/docs/plugins', permanent: true },
      // Sponsors and resources moved out of the docs tree into app routes.
      { source: '/docs/sponsors', destination: '/sponsors', permanent: true },
      { source: '/docs/resources', destination: '/resources', permanent: true },
    ];
  },
};

export default withMDX(config);
