import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type {
  Comment,
  CommentReply,
  CreateCommentInput,
  ReviewFile,
  UpdateCommentInput,
} from '../types';

const EMPTY_FILE: ReviewFile = { version: 1, comments: [] };

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
      return { ...EMPTY_FILE };
    }
    return parsed;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { ...EMPTY_FILE };
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
  const tmp = `${storagePath}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
  await rename(tmp, storagePath);
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
  const storagePath = opts.storagePath ?? defaultStoragePath();

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
    async create(input) {
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
    },
    async update(id, patch) {
      const file = await readReviewFile(storagePath);
      const idx = file.comments.findIndex((c) => c.id === id);
      if (idx === -1) return null;
      const current = file.comments[idx];
      const next: Comment = { ...current };
      if (patch.status) next.status = patch.status;
      if (typeof patch.body === 'string') next.body = patch.body;
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
    },
    async remove(id) {
      const file = await readReviewFile(storagePath);
      const before = file.comments.length;
      file.comments = file.comments.filter((c) => c.id !== id);
      if (file.comments.length === before) return false;
      await writeReviewFile(storagePath, file);
      return true;
    },
  };
}
