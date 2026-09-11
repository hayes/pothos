import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

// Allow browsers and well-behaved crawlers to cache the plain-text docs instead
// of re-downloading them on every visit (they only change on deploy).
const llmTextCacheHeaders = [
  {
    key: 'Cache-Control',
    value: 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
  },
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
