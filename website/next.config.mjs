import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Redirect map for the docs.
//
// The 2026 reorg eliminated the `guide/` wrapper entirely. The three reading-
// path sections — Getting started, Fundamentals, Patterns — are now top-level
// directories alongside Plugins and Migrations:
//
//   /docs/getting-started/{introduction,installation,first-server}
//   /docs/fundamentals/{schema-builder,objects,fields,…,scalars}
//   /docs/patterns/{project-layout,handling-errors,…,reusable-fields}
//   /docs/{using-plugins,playground,troubleshooting}
//
// These redirects handle three eras of legacy URLs that all map back to the
// new top-level paths:
//
//   1. Pre-rewrite flat URLs (/docs/guide/objects, /docs/guide/queries, …)
//   2. Brief mid-rewrite subdir URLs (/docs/guide/fundamentals/objects)
//   3. Last week's flat-under-guide URLs (/docs/guide/objects, /docs/guide/queries)
//
// All three collapse to the same set of canonical destinations.
const guideRedirects = [
  // Bare /docs/guide has no destination of its own — send people to Introduction.
  { source: '/docs/guide', destination: '/docs/getting-started/introduction' },

  // Getting started: 3 pages, plus the section landing.
  { source: '/docs/guide/getting-started', destination: '/docs/getting-started/introduction' },
  { source: '/docs/guide/getting-started/:slug', destination: '/docs/getting-started/:slug' },
  { source: '/docs/guide/introduction', destination: '/docs/getting-started/introduction' },
  { source: '/docs/guide/installation', destination: '/docs/getting-started/installation' },
  { source: '/docs/guide/first-server', destination: '/docs/getting-started/first-server' },

  // Fundamentals: 14 pages, plus the section landing.
  { source: '/docs/guide/fundamentals', destination: '/docs/fundamentals/schema-builder' },
  { source: '/docs/guide/fundamentals/:slug', destination: '/docs/fundamentals/:slug' },
  { source: '/docs/guide/schema-builder', destination: '/docs/fundamentals/schema-builder' },
  { source: '/docs/guide/objects', destination: '/docs/fundamentals/objects' },
  { source: '/docs/guide/fields', destination: '/docs/fundamentals/fields' },
  { source: '/docs/guide/resolvers', destination: '/docs/fundamentals/resolvers' },
  { source: '/docs/guide/context', destination: '/docs/fundamentals/context' },
  { source: '/docs/guide/args', destination: '/docs/fundamentals/args' },
  { source: '/docs/guide/inputs', destination: '/docs/fundamentals/inputs' },
  { source: '/docs/guide/queries', destination: '/docs/fundamentals/queries' },
  { source: '/docs/guide/mutations', destination: '/docs/fundamentals/mutations' },
  { source: '/docs/guide/subscriptions', destination: '/docs/fundamentals/subscriptions' },
  { source: '/docs/guide/interfaces', destination: '/docs/fundamentals/interfaces' },
  { source: '/docs/guide/unions', destination: '/docs/fundamentals/unions' },
  { source: '/docs/guide/enums', destination: '/docs/fundamentals/enums' },
  { source: '/docs/guide/scalars', destination: '/docs/fundamentals/scalars' },
  // queries-mutations-and-subscriptions split into three; mutations is the canonical successor.
  { source: '/docs/guide/queries-mutations-and-subscriptions', destination: '/docs/fundamentals/mutations' },

  // Patterns: 7 pages, plus the section landing.
  { source: '/docs/guide/patterns', destination: '/docs/patterns/project-layout' },
  { source: '/docs/guide/patterns/:slug', destination: '/docs/patterns/:slug' },
  { source: '/docs/guide/project-layout', destination: '/docs/patterns/project-layout' },
  { source: '/docs/guide/handling-errors', destination: '/docs/patterns/handling-errors' },
  { source: '/docs/guide/default-nullability', destination: '/docs/patterns/default-nullability' },
  { source: '/docs/guide/circular-references', destination: '/docs/patterns/circular-references' },
  { source: '/docs/guide/inferring-types', destination: '/docs/patterns/inferring-types' },
  { source: '/docs/guide/printing-and-codegen', destination: '/docs/patterns/printing-and-codegen' },
  { source: '/docs/guide/reusable-fields', destination: '/docs/patterns/reusable-fields' },
  // app-layout → project-layout rename.
  { source: '/docs/guide/app-layout', destination: '/docs/patterns/project-layout' },
  // changing-default-nullability → default-nullability rename.
  { source: '/docs/guide/changing-default-nullability', destination: '/docs/patterns/default-nullability' },
  // printing-schemas + generating-client-types merged into printing-and-codegen.
  { source: '/docs/guide/printing-schemas', destination: '/docs/patterns/printing-and-codegen' },
  { source: '/docs/guide/generating-client-types', destination: '/docs/patterns/printing-and-codegen' },

  // Standalone top-level pages.
  { source: '/docs/guide/using-plugins', destination: '/docs/using-plugins' },
  { source: '/docs/guide/playground', destination: '/docs/playground' },
  { source: '/docs/guide/troubleshooting', destination: '/docs/troubleshooting' },

  // writing-plugins moved out of the core guide.
  { source: '/docs/guide/writing-plugins', destination: '/docs/plugins/writing-plugins' },
];

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx/:path*',
      },
    ];
  },
  redirects() {
    return guideRedirects.map((r) => ({ ...r, permanent: true }));
  },
};

export default withMDX(config);
