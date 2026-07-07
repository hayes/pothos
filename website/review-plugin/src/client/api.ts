import type { Comment, CreateCommentInput, UpdateCommentInput } from '../types';

export class ReviewApiClient {
  constructor(private base: string) {}

  async list(): Promise<{ storagePath: string; comments: Comment[] }> {
    const res = await fetch(this.base, { cache: 'no-store' });
    if (!res.ok) throw new Error(`list failed: ${res.status}`);
    return (await res.json()) as { storagePath: string; comments: Comment[] };
  }

  async create(input: CreateCommentInput): Promise<Comment> {
    const res = await fetch(this.base, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`create failed: ${res.status}`);
    return (await res.json()) as Comment;
  }

  async update(id: string, patch: UpdateCommentInput): Promise<Comment> {
    const res = await fetch(`${this.base}/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(`update failed: ${res.status}`);
    return (await res.json()) as Comment;
  }

  async remove(id: string): Promise<void> {
    const res = await fetch(`${this.base}/${id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`delete failed: ${res.status}`);
  }
}
