import { join, resolve } from 'node:path';
import { createReviewRouteHandlers } from '@/review-plugin/src/server';

/**
 * Dev-only review feedback API.
 *
 * `createReviewRouteHandlers` 404s in production at request time, and the
 * client overlay that talks to this route is itself tree-shaken from prod
 * bundles, so this endpoint is effectively inert for readers of the site.
 *
 * The storage file lives at the **repo root**, not the website cwd, so the
 * `/review-docs` skill (which runs at the repo root) reads and writes the
 * same file the dev server is serving from. `process.cwd()` is `website/`
 * when Next.js runs from a pnpm filter; `../` walks up to the workspace root.
 */
const STORAGE_PATH = join(resolve(process.cwd(), '..'), '.claude', 'review-feedback.json');

export const dynamic = 'force-dynamic';
export const { GET, POST, PATCH, DELETE } = createReviewRouteHandlers({
  storagePath: STORAGE_PATH,
});
