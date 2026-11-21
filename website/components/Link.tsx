'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof NextLink>;

/**
 * `next/link` without viewport prefetching. Use this instead of `next/link`.
 *
 * By default every `next/link` prefetches its page as soon as it scrolls into
 * view. The docs sidebar alone renders ~90 links, so a single page view fired
 * ~100 prefetch requests. On Vercel those prefetches are CDN requests, and
 * because their `_rsc` cache key depends on the page they were sent from, most
 * miss the cache and also count as ISR reads and Fast Origin Transfer. That
 * exhausted the Hobby quotas and took the site down.
 *
 * Here prefetching happens only when a link is hovered or focused, so
 * navigation still feels instant but a page view costs one request per link
 * the reader actually reaches for.
 */
export function Link({ prefetch, onMouseEnter, onFocus, href, ...props }: Props) {
  const router = useRouter();
  const url = typeof href === 'string' ? href : null;
  const prefetchOnIntent = prefetch !== false && url !== null && url.startsWith('/');

  return (
    <NextLink
      {...props}
      href={href}
      prefetch={false}
      onMouseEnter={(event) => {
        if (prefetchOnIntent) {
          router.prefetch(url);
        }
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        if (prefetchOnIntent) {
          router.prefetch(url);
        }
        onFocus?.(event);
      }}
    />
  );
}

/** Adapter for fumadocs' `NextProvider`, so its breadcrumbs, TOC and page footer links skip viewport prefetching too. */
export function FumadocsLink({
  href = '#',
  prefetch,
  ...props
}: ComponentProps<'a'> & { prefetch?: boolean }) {
  return <Link href={href} prefetch={prefetch} {...props} />;
}

export default Link;
