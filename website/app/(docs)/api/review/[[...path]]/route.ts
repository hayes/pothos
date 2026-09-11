import { join, resolve } from 'node:path';

type ReviewHandlers = ReturnType<
  typeof import('@/review-plugin/src/server')['createReviewRouteHandlers']
>;

// Keep the filesystem-backed review API out of production route bundles.
// Feedback lives at the repo root so the dev server and review tools share it.
const handlers =
  process.env.NODE_ENV === 'development'
    ? import('@/review-plugin/src/server').then(({ createReviewRouteHandlers }) =>
        createReviewRouteHandlers({
          storagePath: join(resolve(process.cwd(), '..'), '.claude', 'review-feedback.json'),
        }),
      )
    : null;

function handle(method: keyof ReviewHandlers): ReviewHandlers['GET'] {
  return async (req, ctx) =>
    handlers ? (await handlers)[method](req, ctx) : new Response('Not Found', { status: 404 });
}

export const dynamic = 'force-dynamic';
export const GET = handle('GET');
export const POST = handle('POST');
export const PATCH = handle('PATCH');
export const DELETE = handle('DELETE');
