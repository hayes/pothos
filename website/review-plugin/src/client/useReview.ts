'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReviewApiClient } from './api';
import type { Comment, CommentStatus, CreateCommentInput } from '../types';

/**
 * Single source of truth for the overlay's comment list. Polls the server at
 * a slow cadence so claude-side replies show up without a hard refresh; users
 * can still call `refresh()` to force an immediate read.
 */

const POLL_MS = 4000;

interface UseReviewArgs {
  apiBase: string;
  currentPage: string;
}

export interface ReviewState {
  all: Comment[];
  onPage: Comment[];
  storagePath: string | null;
  loading: boolean;
  error: string | null;
  create: (input: CreateCommentInput) => Promise<Comment>;
  reply: (id: string, body: string) => Promise<Comment>;
  setStatus: (id: string, status: CommentStatus) => Promise<Comment>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useReview({ apiBase, currentPage }: UseReviewArgs): ReviewState {
  const client = useMemo(() => new ReviewApiClient(apiBase), [apiBase]);
  const [all, setAll] = useState<Comment[]>([]);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const data = await client.list();
      if (!mounted.current) return;
      setAll(data.comments);
      setStoragePath(data.storagePath);
      setError(null);
    } catch (err) {
      if (!mounted.current) return;
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const iv = setInterval(refresh, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(iv);
    };
  }, [refresh]);

  const onPage = useMemo(() => all.filter((c) => c.page === currentPage), [all, currentPage]);

  const create = useCallback<ReviewState['create']>(
    async (input) => {
      const created = await client.create(input);
      setAll((prev) => [...prev, created]);
      return created;
    },
    [client],
  );

  const reply = useCallback<ReviewState['reply']>(
    async (id, body) => {
      const updated = await client.update(id, { addReply: { author: 'user', body } });
      setAll((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [client],
  );

  const setStatus = useCallback<ReviewState['setStatus']>(
    async (id, status) => {
      const updated = await client.update(id, { status });
      setAll((prev) => prev.map((c) => (c.id === id ? updated : c)));
      return updated;
    },
    [client],
  );

  const remove = useCallback<ReviewState['remove']>(
    async (id) => {
      await client.remove(id);
      setAll((prev) => prev.filter((c) => c.id !== id));
    },
    [client],
  );

  return { all, onPage, storagePath, loading, error, create, reply, setStatus, remove, refresh };
}
