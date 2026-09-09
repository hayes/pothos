import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pothos-graphql.dev';

/**
 * robots.txt — docs are freely crawlable; point crawlers at the sitemap.
 * Plain-text versions for LLMs/agents are available at /llms.txt (index),
 * /llms-full.txt (full corpus), and per-page at /docs/<page>.mdx.
 * The internal search endpoint is not useful to crawlers and each hit
 * invokes a function, so /api/ is disallowed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: new URL('/sitemap.xml', SITE_URL).toString(),
    host: SITE_URL,
  };
}
