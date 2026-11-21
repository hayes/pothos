import type { MetadataRoute } from 'next';
import { source } from '@/app/source';

export const dynamic = 'force-static';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pothos-graphql.dev';

// Top-level routes that aren't part of the fumadocs page tree. `/docs`
// (the overview) is emitted by the page-tree loop below, so it's omitted
// here to avoid a duplicate entry.
const STATIC_ROUTES = ['/', '/resources', '/sponsors', '/playground'];

/**
 * XML sitemap for crawlers. Combines the docs page tree (the source of
 * truth for every `/docs/**` URL, kept in sync with the reorg) with the
 * handful of standalone marketing/tool routes. Regenerated on each build,
 * so new docs pages appear automatically.
 */
// Old docs URLs that now redirect elsewhere (see `redirects()` in next.config.mjs);
// a sitemap should only list pages that answer directly.
const REDIRECTED = new Set(['/docs/sponsors', '/docs/resources']);

// The static export serves every page as `<path>/index.html`, so its URLs end in `/`.
const trailingSlash = process.env.STATIC_EXPORT === '1';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) =>
    new URL(trailingSlash && !path.endsWith('/') ? `${path}/` : path, SITE_URL).toString();

  const docs = source
    .getPages()
    .filter((page) => !REDIRECTED.has(page.url))
    .map((page) => ({
      url: url(page.url),
      changeFrequency: 'weekly' as const,
      priority: page.url === '/docs' ? 1 : 0.7,
    }));

  const staticRoutes = STATIC_ROUTES.map((path) => ({
    url: url(path),
    changeFrequency: 'monthly' as const,
    priority: path === '/' ? 1 : 0.5,
  }));

  return [...staticRoutes, ...docs];
}
