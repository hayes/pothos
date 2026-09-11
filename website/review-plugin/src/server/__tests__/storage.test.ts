import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CreateCommentInput } from '../../types';
import { createStorage } from '../storage';

const input: CreateCommentInput = {
  page: '/docs',
  body: 'Feedback',
  anchor: { kind: 'element', selector: 'h1', preview: 'Docs' },
};

let directory: string;
let storagePath: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'pothos-review-'));
  storagePath = join(directory, 'review.json');
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});

describe('review storage', () => {
  it('starts empty after deleting feedback or opening another storage file', async () => {
    const storage = createStorage({ storagePath });
    await storage.create(input);
    await rm(storagePath);
    expect(await storage.list()).toEqual([]);
    expect(await createStorage({ storagePath: join(directory, 'other.json') }).list()).toEqual([]);
    await writeFile(storagePath, JSON.stringify({ version: 2, comments: [] }));
    expect(await storage.list()).toEqual([]);
  });

  it('preserves concurrent creates and replies across storage instances', async () => {
    const storage = createStorage({ storagePath });
    const other = createStorage({ storagePath: join(directory, '.', 'review.json') });
    const comments = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        (index % 2 ? storage : other).create({ ...input, body: String(index) }),
      ),
    );
    expect(await storage.list()).toHaveLength(10);
    await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        (index % 2 ? storage : other).update(comments[0].id, {
          addReply: { author: 'user', body: String(index) },
        }),
      ),
    );
    expect((await storage.get(comments[0].id))?.replies).toHaveLength(10);
    await Promise.all(comments.map((comment) => other.remove(comment.id)));
    expect(await storage.list()).toEqual([]);
  });

  it('allows subsequent mutations after a failed write', async () => {
    const storage = createStorage({ storagePath });
    await writeFile(storagePath, 'invalid JSON');
    await expect(storage.create(input)).rejects.toThrow();
    await rm(storagePath);
    await expect(storage.create(input)).resolves.toMatchObject(input);
  });
});
