'use client';

/**
 * Public client entrypoint.
 *
 * Both exports are dev-only by construction:
 *
 *  - In **development**, they resolve via `next/dynamic` to the real
 *    components. The dynamic-import call site stays in the source.
 *  - In **production**, `process.env.NODE_ENV === 'development'` is a
 *    statically-known `false`, so the conditional collapses, the dynamic-
 *    import callback is dead code, and Turbopack drops the entire transitive
 *    chunk graph behind it — components, CSS, anchoring logic, all of it.
 *
 * The deliberate consequence: the host site has nothing to do to "disable" the
 * plugin in production. Importing this file is enough — production renders
 * `null` for the provider and the index page, and ships zero plugin bytes.
 *
 * If you need the raw components (e.g. for a Storybook preview or a custom
 * dev-only host), import them directly from `./ReviewProvider` and
 * `./ReviewIndex`. Those paths always include the implementation.
 */

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';

export type { Comment, CommentAnchor, CommentReply, CommentStatus } from '../types';

const NoopComponent: ComponentType<unknown> = () => null;

export interface ReviewProviderProps {
  apiBase?: string;
  contentSelector?: string;
  pagePath?: string;
  pageTitle?: string;
}

export interface ReviewIndexProps {
  apiBase?: string;
}

export const ReviewProviderDevOnly: ComponentType<ReviewProviderProps> =
  process.env.NODE_ENV === 'development'
    ? (dynamic(
        () => import('./ReviewProvider').then((m) => m.ReviewProvider),
        { ssr: false },
      ) as ComponentType<ReviewProviderProps>)
    : (NoopComponent as ComponentType<ReviewProviderProps>);

export const ReviewIndexPage: ComponentType<ReviewIndexProps> =
  process.env.NODE_ENV === 'development'
    ? (dynamic(
        () => import('./ReviewIndex').then((m) => m.ReviewIndex),
        { ssr: false },
      ) as ComponentType<ReviewIndexProps>)
    : (NoopComponent as ComponentType<ReviewIndexProps>);
