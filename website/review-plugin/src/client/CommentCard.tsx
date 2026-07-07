'use client';

import { useState } from 'react';
import type { Comment, CommentStatus } from '../types';

interface CommentCardProps {
  comment: Comment;
  onReply: (id: string, body: string) => Promise<void>;
  onSetStatus: (id: string, status: CommentStatus) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onJump?: (id: string) => void;
  showPage?: boolean;
  expanded?: boolean;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = (now - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

export function CommentCard({
  comment,
  onReply,
  onSetStatus,
  onRemove,
  onJump,
  showPage,
  expanded: expandedProp,
}: CommentCardProps) {
  const [expanded, setExpanded] = useState(expandedProp ?? false);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState(false);

  const open = expandedProp ?? expanded;

  const handleReply = async () => {
    const body = replyText.trim();
    if (!body) return;
    setBusy(true);
    try {
      await onReply(comment.id, body);
      setReplyText('');
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (status: CommentStatus) => {
    setBusy(true);
    try {
      await onSetStatus(comment.id, status);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Delete this comment and its replies?')) return;
    setBusy(true);
    try {
      await onRemove(comment.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rp-card"
      data-status={comment.status}
      onClick={() => {
        if (expandedProp === undefined) setExpanded((v) => !v);
        onJump?.(comment.id);
      }}
    >
      <div className="rp-card-head">
        <span className="rp-pill" data-status={comment.status}>
          {comment.status.replace('-', ' ')}
        </span>
        <span className="rp-meta">{formatTime(comment.createdAt)}</span>
      </div>
      {showPage && (
        <div className="rp-meta" style={{ marginBottom: 4 }}>
          {comment.pageTitle ?? comment.page}
        </div>
      )}
      {comment.anchor.kind === 'range' && (
        <div className="rp-quote">"{comment.anchor.quote.slice(0, 240)}"</div>
      )}
      {comment.anchor.kind === 'element' && comment.anchor.preview && (
        <div className="rp-quote">{comment.anchor.preview}</div>
      )}
      <div className="rp-body">{comment.body}</div>
      {open && comment.replies.length > 0 && (
        <div className="rp-replies">
          {comment.replies.map((r) => (
            <div key={r.id} className="rp-reply" data-author={r.author}>
              <div className="rp-reply-head">
                <strong>{r.author}</strong> · {formatTime(r.createdAt)}
              </div>
              <div className="rp-body">{r.body}</div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <textarea
            placeholder="Reply…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            style={{
              width: '100%',
              marginTop: 8,
              minHeight: 48,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--rp-border)',
              borderRadius: 6,
              padding: 6,
              color: 'inherit',
              font: 'inherit',
            }}
          />
          <div className="rp-composer-row" style={{ marginTop: 6 }}>
            <button
              type="button"
              className="rp-btn"
              onClick={handleRemove}
              disabled={busy}
              title="Delete"
            >
              ✕
            </button>
            {comment.status !== 'resolved' ? (
              <button
                type="button"
                className="rp-btn"
                onClick={() => handleStatus('resolved')}
                disabled={busy}
              >
                Resolve
              </button>
            ) : (
              <button
                type="button"
                className="rp-btn"
                onClick={() => handleStatus('open')}
                disabled={busy}
              >
                Reopen
              </button>
            )}
            <button
              type="button"
              className="rp-btn"
              data-primary="true"
              onClick={handleReply}
              disabled={busy || !replyText.trim()}
            >
              Reply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
