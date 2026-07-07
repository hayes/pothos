import { type ReviewStorage, createStorage } from './storage';
import type { CreateCommentInput, UpdateCommentInput } from '../types';

interface RouteHandlerContext {
  params: Promise<{ path?: string[] }>;
}

interface CreateReviewRouteHandlersOptions {
  storagePath?: string;
  /**
   * Override the production-disable check. By default the handler returns 404
   * unless `process.env.NODE_ENV === 'development'`. Set to `true` to force-
   * enable (e.g. for an internal preview deploy).
   */
  enabled?: boolean;
}

function notFound() {
  return new Response('Not Found', { status: 404 });
}

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
}

function isEnabled(opts: CreateReviewRouteHandlersOptions): boolean {
  if (typeof opts.enabled === 'boolean') return opts.enabled;
  return process.env.NODE_ENV === 'development';
}

/**
 * Reads `[[...path]]` out of the catch-all route. The route handler is mounted
 * at `app/api/review/[[...path]]/route.ts`, so:
 *   GET    /api/review              → list all comments
 *   POST   /api/review              → create a comment
 *   GET    /api/review/<id>         → fetch one
 *   PATCH  /api/review/<id>         → update (status, body, or addReply)
 *   DELETE /api/review/<id>         → remove
 */
async function getId(ctx: RouteHandlerContext): Promise<string | null> {
  const { path } = await ctx.params;
  if (!path || path.length === 0) return null;
  return path[0] ?? null;
}

export function createReviewRouteHandlers(opts: CreateReviewRouteHandlersOptions = {}) {
  const enabled = () => isEnabled(opts);
  let cached: ReviewStorage | null = null;
  const storage = () => {
    cached ??= createStorage({ storagePath: opts.storagePath });
    return cached;
  };

  return {
    async GET(_req: Request, ctx: RouteHandlerContext) {
      if (!enabled()) return notFound();
      const id = await getId(ctx);
      if (id) {
        const comment = await storage().get(id);
        if (!comment) return notFound();
        return json(comment);
      }
      const comments = await storage().list();
      return json({ storagePath: storage().storagePath, comments });
    },

    async POST(req: Request, ctx: RouteHandlerContext) {
      if (!enabled()) return notFound();
      if (await getId(ctx)) return new Response('Method Not Allowed', { status: 405 });
      const input = (await req.json()) as CreateCommentInput;
      if (!input.page || !input.body || !input.anchor) {
        return new Response('Missing page/body/anchor', { status: 400 });
      }
      const comment = await storage().create(input);
      return json(comment, { status: 201 });
    },

    async PATCH(req: Request, ctx: RouteHandlerContext) {
      if (!enabled()) return notFound();
      const id = await getId(ctx);
      if (!id) return new Response('Missing id', { status: 400 });
      const patch = (await req.json()) as UpdateCommentInput;
      const updated = await storage().update(id, patch);
      if (!updated) return notFound();
      return json(updated);
    },

    async DELETE(_req: Request, ctx: RouteHandlerContext) {
      if (!enabled()) return notFound();
      const id = await getId(ctx);
      if (!id) return new Response('Missing id', { status: 400 });
      const removed = await storage().remove(id);
      if (!removed) return notFound();
      return new Response(null, { status: 204 });
    },
  };
}
