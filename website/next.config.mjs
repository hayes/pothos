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
};

export default withMDX(config);
