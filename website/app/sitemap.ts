import type { MetadataRoute } from 'next';
import { source } from '@/app/source';

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
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => new URL(path, SITE_URL).toString();

  const docs = source.getPages().map((page) => ({
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
