'use client';

import { useMemo } from 'react';
import { useReview } from './useReview';
import { CommentCard } from './CommentCard';
import type { Comment, CommentStatus } from '../types';
import './styles.css';

interface ReviewIndexProps {
  apiBase?: string;
}

const STATUS_ORDER: CommentStatus[] = ['open', 'needs-clarification', 'resolved', 'wontfix'];

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

/**
 * Index page (`/review`): every comment across every page, grouped by page,
 * filtered by status. Each item links back to its source page with a
 * `#cmt-<id>` hash the provider scrolls to.
 */
export function ReviewIndex({ apiBase = '/api/review' }: ReviewIndexProps) {
  const review = useReview({ apiBase, currentPage: '__index__' });

  const groups = useMemo(() => {
    const sorted = [...review.all].sort((a, b) => {
      const sa = STATUS_ORDER.indexOf(a.status);
      const sb = STATUS_ORDER.indexOf(b.status);
      if (sa !== sb) return sa - sb;
      return b.createdAt.localeCompare(a.createdAt);
    });
    return groupBy(sorted, (c) => c.page);
  }, [review.all]);

  const stats = useMemo(() => {
    const by: Record<string, number> = {};
    for (const c of review.all) by[c.status] = (by[c.status] ?? 0) + 1;
    return by;
  }, [review.all]);

  const handleReply = (id: string, body: string) => review.reply(id, body).then(() => undefined);
  const handleSetStatus = (id: string, status: CommentStatus) =>
    review.setStatus(id, status).then(() => undefined);
  const handleRemove = (id: string) => review.remove(id);

  return (
    <div className="rp-root">
      <div className="rp-index">
        <div className="rp-index-header">
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Review feedback</h1>
            <div className="rp-index-stat">
              {review.storagePath ?? 'no storage yet'}
            </div>
          </div>
          <div className="rp-index-stat">
            {review.all.length} total
            {Object.entries(stats).map(([k, v]) => (
              <span key={k} style={{ marginLeft: 8 }}>
                · <strong style={{ color: 'var(--rp-fg)' }}>{v}</strong> {k}
              </span>
            ))}
          </div>
        </div>
        {review.error && (
          <div className="rp-empty" style={{ color: '#f87171' }}>
            {review.error}
          </div>
        )}
        {review.all.length === 0 && !review.loading && (
          <div className="rp-empty">
            No feedback yet. Open any docs page and click the <strong>Review</strong> button
            (bottom-right) to start.
          </div>
        )}
        {Object.entries(groups).map(([page, comments]) => (
          <div key={page} className="rp-index-group">
            <div className="rp-index-group-title">
              <a href={page} style={{ color: 'inherit' }}>
                {comments[0]?.pageTitle ?? page}
              </a>{' '}
              <span className="rp-index-stat">· {page}</span>
            </div>
            {comments.map((c) => (
              <a
                key={c.id}
                href={`${page}#cmt-${c.id}`}
                className="rp-index-item"
                style={{ display: 'block' }}
              >
                <PreviewCard comment={c} />
              </a>
            ))}
          </div>
        ))}
        {/* Detail cards below the index (status + reply) */}
        {review.all.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ margin: '24px 0 8px', fontSize: 16, fontWeight: 600 }}>Threads</h2>
            {review.all.map((c) => (
              <div key={c.id} id={`cmt-${c.id}`} style={{ marginBottom: 12 }}>
                <CommentCard
                  comment={c}
                  onReply={handleReply}
                  onSetStatus={handleSetStatus}
                  onRemove={handleRemove}
                  showPage
                  expanded
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewCard({ comment }: { comment: Comment }) {
  return (
    <div>
      <div className="rp-index-item-head">
        <span className="rp-pill" data-status={comment.status}>
          {comment.status.replace('-', ' ')}
        </span>
        <span className="rp-index-item-page">
          {comment.replies.length > 0 && `${comment.replies.length} repl${comment.replies.length === 1 ? 'y' : 'ies'} · `}
          {new Date(comment.createdAt).toLocaleString()}
        </span>
      </div>
      {comment.anchor.kind === 'range' && (
        <div className="rp-quote">"{comment.anchor.quote.slice(0, 200)}"</div>
      )}
      <div className="rp-body">{comment.body}</div>
    </div>
  );
}
