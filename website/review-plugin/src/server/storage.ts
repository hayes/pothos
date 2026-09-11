import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type {
  Comment,
  CommentReply,
  CreateCommentInput,
  ReviewFile,
  UpdateCommentInput,
} from '../types';

const pendingWrites = new Map<string, Promise<unknown>>();

// Serialize the whole read/modify/write operation, including across storage instances.
function mutate<T>(storagePath: string, operation: () => Promise<T>): Promise<T> {
  const previous = pendingWrites.get(storagePath) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(operation);
  pendingWrites.set(storagePath, next);
  const cleanup = () => {
    if (pendingWrites.get(storagePath) === next) {
      pendingWrites.delete(storagePath);
    }
  };
  void next.then(cleanup, cleanup);
  return next;
}

/**
 * Resolves the default storage location: `<cwd>/.claude/review-feedback.json`.
 * Callers can override with `createStorage({ storagePath })`.
 */
function defaultStoragePath(): string {
  return join(process.cwd(), '.claude', 'review-feedback.json');
}

function randomId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}${random}`;
}

async function readReviewFile(storagePath: string): Promise<ReviewFile> {
  try {
    const raw = await readFile(storagePath, 'utf8');
    const parsed = JSON.parse(raw) as ReviewFile;
    if (parsed.version !== 1 || !Array.isArray(parsed.comments)) {
      return { version: 1, comments: [] };
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { version: 1, comments: [] };
    }
    throw err;
  }
}

/**
 * Atomic write via tmp + rename. Concurrent dev requests + skill writes both
 * touch this file; we want last-writer-wins on the file as a whole rather than
 * a half-written JSON document.
 */
async function writeReviewFile(storagePath: string, file: ReviewFile): Promise<void> {
  await mkdir(dirname(storagePath), { recursive: true });
  const tmp = `${storagePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    await rename(tmp, storagePath);
  } finally {
    await rm(tmp, { force: true });
  }
}

export interface ReviewStorage {
  list(): Promise<Comment[]>;
  get(id: string): Promise<Comment | null>;
  create(input: CreateCommentInput): Promise<Comment>;
  update(id: string, patch: UpdateCommentInput): Promise<Comment | null>;
  remove(id: string): Promise<boolean>;
  storagePath: string;
}

export function createStorage(opts: { storagePath?: string } = {}): ReviewStorage {
  const storagePath = resolve(opts.storagePath ?? defaultStoragePath());

  return {
    storagePath,
    async list() {
      const file = await readReviewFile(storagePath);
      return file.comments;
    },
    async get(id) {
      const file = await readReviewFile(storagePath);
      return file.comments.find((c) => c.id === id) ?? null;
    },
    create(input) {
      return mutate(storagePath, async () => {
        const file = await readReviewFile(storagePath);
        const now = new Date().toISOString();
        const comment: Comment = {
          id: randomId('cmt'),
          page: input.page,
          pageTitle: input.pageTitle,
          anchor: input.anchor,
          body: input.body,
          author: input.author ?? 'user',
          createdAt: now,
          status: 'open',
          replies: [],
        };
        file.comments.push(comment);
        await writeReviewFile(storagePath, file);
        return comment;
      });
    },
    update(id, patch) {
      return mutate(storagePath, async () => {
        const file = await readReviewFile(storagePath);
        const idx = file.comments.findIndex((c) => c.id === id);
        if (idx === -1) {
          return null;
        }
        const current = file.comments[idx];
        const next: Comment = { ...current };
        if (patch.status) {
          next.status = patch.status;
        }
        if (typeof patch.body === 'string') {
          next.body = patch.body;
        }
        if (patch.addReply) {
          const reply: CommentReply = {
            id: randomId('rep'),
            author: patch.addReply.author,
            body: patch.addReply.body,
            createdAt: new Date().toISOString(),
          };
          next.replies = [...current.replies, reply];
        }
        file.comments[idx] = next;
        await writeReviewFile(storagePath, file);
        return next;
      });
    },
    remove(id) {
      return mutate(storagePath, async () => {
        const file = await readReviewFile(storagePath);
        const before = file.comments.length;
        file.comments = file.comments.filter((c) => c.id !== id);
        if (file.comments.length === before) {
          return false;
        }
        await writeReviewFile(storagePath, file);
        return true;
      });
    },
  };
}
