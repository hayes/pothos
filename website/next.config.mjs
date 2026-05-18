import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Old guide slug → new home. The 2026 rewrite moved every page under
// fundamentals/ or patterns/ subdirectories and split a few. These
// keep old links and search-engine results pointing at the right pages.
const guideRedirects = [
  // Split queries-mutations-and-subscriptions; mutations is the canonical successor.
  { source: '/docs/guide/queries-mutations-and-subscriptions', destination: '/docs/guide/fundamentals/mutations' },

  // Fundamentals — flat → fundamentals/<slug>.
  { source: '/docs/guide/objects', destination: '/docs/guide/fundamentals/objects' },
  { source: '/docs/guide/schema-builder', destination: '/docs/guide/fundamentals/schema-builder' },
  { source: '/docs/guide/fields', destination: '/docs/guide/fundamentals/fields' },
  { source: '/docs/guide/args', destination: '/docs/guide/fundamentals/args' },
  { source: '/docs/guide/context', destination: '/docs/guide/fundamentals/context' },
  { source: '/docs/guide/inputs', destination: '/docs/guide/fundamentals/inputs' },
  { source: '/docs/guide/enums', destination: '/docs/guide/fundamentals/enums' },
  { source: '/docs/guide/scalars', destination: '/docs/guide/fundamentals/scalars' },
  { source: '/docs/guide/interfaces', destination: '/docs/guide/fundamentals/interfaces' },
  { source: '/docs/guide/unions', destination: '/docs/guide/fundamentals/unions' },

  // Patterns — flat → patterns/<slug>, plus a couple of renames and merges.
  { source: '/docs/guide/app-layout', destination: '/docs/guide/patterns/project-layout' },
  { source: '/docs/guide/changing-default-nullability', destination: '/docs/guide/patterns/default-nullability' },
  { source: '/docs/guide/circular-references', destination: '/docs/guide/patterns/circular-references' },
  { source: '/docs/guide/inferring-types', destination: '/docs/guide/patterns/inferring-types' },
  // printing-schemas + generating-client-types merged into printing-and-codegen.
  { source: '/docs/guide/printing-schemas', destination: '/docs/guide/patterns/printing-and-codegen' },
  { source: '/docs/guide/generating-client-types', destination: '/docs/guide/patterns/printing-and-codegen' },
  // patterns.mdx kept only its "sharing fields" content, which is now reusable-fields.
  { source: '/docs/guide/patterns', destination: '/docs/guide/patterns/reusable-fields' },

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
