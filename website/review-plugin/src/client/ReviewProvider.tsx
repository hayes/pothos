'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { captureElementAnchor, captureRangeAnchor, resolveAnchor } from './anchoring';
import { useReview } from './useReview';
import { CommentCard } from './CommentCard';
import { Composer } from './Composer';
import type { Comment, CommentAnchor, CommentStatus } from '../types';
import './styles.css';

const STORAGE_KEY = 'pothos-review-state';

type Mode = 'idle' | 'select' | 'element';

interface ProviderProps {
  /** API base path. Defaults to `/api/review`. */
  apiBase?: string;
  /**
   * Selector that bounds the content reviewers can annotate. Anything outside
   * is ignored (so reviewers can't accidentally pin to nav chrome). Defaults
   * to `main`, falling back to `document.body` if there's no `main`.
   */
  contentSelector?: string;
  /** Override the page identifier sent to the API. Defaults to `usePathname()`. */
  pagePath?: string;
  /** Optional display title for the current page. */
  pageTitle?: string;
}

interface PendingDraft {
  anchor: CommentAnchor;
  position: { top: number; left: number };
  preview: string;
}

/**
 * Top-level overlay component. Mounts a floating toolbar, manages comment
 * capture, draws highlights for existing comments, and renders the side panel.
 * Stateful pieces (open panel, mode) persist in sessionStorage so a hard
 * refresh in the middle of a review keeps the UI where it was.
 */
export function ReviewProvider({
  apiBase = '/api/review',
  contentSelector = 'main',
  pagePath,
  pageTitle,
}: ProviderProps) {
  const pathname = usePathname();
  const currentPage = pagePath ?? pathname ?? '/';
  const review = useReview({ apiBase, currentPage });

  const [enabled, setEnabled] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [tab, setTab] = useState<'page' | 'all'>('page');
  const [draft, setDraft] = useState<PendingDraft | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Persist UI state across reloads so a `pnpm dev` restart doesn't dump the
  // reviewer back to a closed panel.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { enabled?: boolean; panelOpen?: boolean };
        if (parsed.enabled) setEnabled(true);
        if (parsed.panelOpen) setPanelOpen(true);
      }
    } catch {}
  }, []);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, panelOpen }));
    } catch {}
  }, [enabled, panelOpen]);

  const contentRoot = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return (document.querySelector(contentSelector) as HTMLElement | null) ?? document.body;
  }, [contentSelector, pathname]);

  /* ----- highlight overlay ----- */
  // Two kinds of nodes get tracked:
  //  - `<mark class="rp-highlight">` wrappers — created via `range.surroundContents`,
  //    so their children are the *original* selected DOM. Cleanup has to unwrap
  //    them (move children out, remove the wrapper) or the page text disappears.
  //  - `<span class="rp-pin">` pins — fresh nodes whose text content is the
  //    artificial pin number. Cleanup has to *remove* them outright; unwrapping
  //    leaves the "1" text behind, and the next poll prepends a fresh pin next
  //    to it, accumulating "1 1 1 1 ..." every cycle.
  const highlightWrappers = useRef<HTMLElement[]>([]);
  const clearHighlights = useCallback(() => {
    for (const node of highlightWrappers.current) {
      const parent = node.parentNode;
      if (!parent) continue;
      if (node.classList.contains('rp-pin')) {
        parent.removeChild(node);
      } else {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        parent.removeChild(node);
        parent.normalize();
      }
    }
    highlightWrappers.current = [];
  }, []);

  const drawHighlights = useCallback(
    (comments: Comment[]) => {
      clearHighlights();
      if (!enabled || !contentRoot) return;
      for (let i = 0; i < comments.length; i++) {
        const comment = comments[i];
        const resolved = resolveAnchor(comment.anchor, contentRoot);
        if (!resolved) continue;
        if (comment.anchor.kind === 'range' && resolved.exact) {
          try {
            const wrapper = document.createElement('mark');
            wrapper.className = 'rp-highlight';
            wrapper.dataset.status = comment.status;
            wrapper.dataset.commentId = comment.id;
            wrapper.title = `${comment.author}: ${comment.body}`;
            // surround can throw if the range crosses non-Text boundaries.
            try {
              resolved.range.surroundContents(wrapper);
            } catch {
              // Fall back: insert a marker pin at the start of the range.
              const pin = document.createElement('span');
              pin.className = 'rp-pin';
              pin.textContent = String(i + 1);
              pin.dataset.commentId = comment.id;
              resolved.range.insertNode(pin);
              highlightWrappers.current.push(pin);
              continue;
            }
            highlightWrappers.current.push(wrapper);
          } catch {}
        } else {
          // Element anchor or fuzzy range: insert a pin marker as a sibling.
          const pin = document.createElement('span');
          pin.className = 'rp-pin';
          pin.textContent = String(i + 1);
          pin.dataset.commentId = comment.id;
          pin.title = `${comment.author}: ${comment.body}`;
          resolved.element.prepend(pin);
          highlightWrappers.current.push(pin);
        }
      }
    },
    [enabled, contentRoot, clearHighlights],
  );

  useEffect(() => {
    drawHighlights(review.onPage);
    return () => clearHighlights();
  }, [drawHighlights, clearHighlights, review.onPage, pathname]);

  // Click on a highlight → focus the matching card.
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const id = target?.closest<HTMLElement>('[data-comment-id]')?.dataset.commentId;
      if (id) {
        e.preventDefault();
        e.stopPropagation();
        setFocusedId(id);
        setPanelOpen(true);
      }
    };
    document.addEventListener('click', handler, true);
    return () => document.removeEventListener('click', handler, true);
  }, [enabled]);

  /* ----- capture: text selection ----- */
  useEffect(() => {
    if (!enabled || mode !== 'select' || !contentRoot) return;
    const handler = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const anchor = captureRangeAnchor(selection, contentRoot);
      if (!anchor) return;
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setDraft({
        anchor,
        preview: anchor.kind === 'range' ? anchor.quote : '',
        position: {
          top: rect.bottom + window.scrollY + 6,
          left: Math.max(8, rect.left + window.scrollX),
        },
      });
      // Clear the selection so the popover isn't covered by browser handles.
      selection.removeAllRanges();
    };
    document.addEventListener('mouseup', handler);
    return () => document.removeEventListener('mouseup', handler);
  }, [enabled, mode, contentRoot]);

  /* ----- capture: element click ----- */
  useEffect(() => {
    if (!enabled || mode !== 'element' || !contentRoot) return;
    let lastHover: HTMLElement | null = null;
    const clearHover = () => {
      if (lastHover) lastHover.classList.remove('rp-target-hover');
      lastHover = null;
    };
    const isReviewChrome = (el: Element | null) =>
      !!el?.closest('.rp-root, .rp-popover, .rp-fab, .rp-panel, [data-comment-id]');
    const move = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !contentRoot.contains(t) || isReviewChrome(t)) {
        clearHover();
        return;
      }
      clearHover();
      lastHover = t;
      t.classList.add('rp-target-hover');
    };
    const click = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || !contentRoot.contains(t) || isReviewChrome(t)) return;
      e.preventDefault();
      e.stopPropagation();
      clearHover();
      const anchor = captureElementAnchor(t);
      const rect = t.getBoundingClientRect();
      setDraft({
        anchor,
        preview: anchor.kind === 'element' ? anchor.preview : '',
        position: {
          top: rect.bottom + window.scrollY + 6,
          left: rect.left + window.scrollX,
        },
      });
      setMode('idle');
    };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('click', click, true);
    return () => {
      clearHover();
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('click', click, true);
    };
  }, [enabled, mode, contentRoot]);

  /* ----- submit handlers ----- */
  const submitDraft = async (body: string) => {
    if (!draft) return;
    await review.create({
      page: currentPage,
      pageTitle,
      anchor: draft.anchor,
      body,
    });
    setDraft(null);
    setPanelOpen(true);
  };

  const handleJump = useCallback(
    (id: string) => {
      if (!contentRoot) return;
      const comment = review.all.find((c) => c.id === id);
      if (!comment) return;
      const resolved = resolveAnchor(comment.anchor, contentRoot);
      if (!resolved) return;
      resolved.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setFocusedId(id);
    },
    [contentRoot, review.all],
  );

  const handleReply = useCallback((id: string, body: string) => review.reply(id, body).then(() => undefined), [review]);
  const handleSetStatus = useCallback(
    (id: string, status: CommentStatus) => review.setStatus(id, status).then(() => undefined),
    [review],
  );
  const handleRemove = useCallback((id: string) => review.remove(id), [review]);

  const visibleComments = tab === 'page' ? review.onPage : review.all;
  const openCount = review.all.filter((c) => c.status === 'open' || c.status === 'needs-clarification').length;

  return (
    <div className="rp-root">
      <button
        type="button"
        className="rp-fab"
        data-active={enabled || undefined}
        onClick={() => {
          if (!enabled) {
            setEnabled(true);
            setPanelOpen(true);
          } else {
            setPanelOpen((v) => !v);
          }
        }}
        title={enabled ? 'Review mode is on. Click to toggle panel.' : 'Start review session'}
      >
        <span>Review</span>
        {openCount > 0 && <span className="rp-fab-count">{openCount}</span>}
      </button>
      {enabled && panelOpen && (
        <div className="rp-panel" onClick={(e) => e.stopPropagation()}>
          <div className="rp-panel-head">
            <strong>Review</strong>
            <span className="rp-muted">
              <button
                type="button"
                className="rp-btn"
                data-primary={mode === 'select' || undefined}
                onClick={() => setMode((m) => (m === 'select' ? 'idle' : 'select'))}
                style={{ marginRight: 4 }}
              >
                Select
              </button>
              <button
                type="button"
                className="rp-btn"
                data-primary={mode === 'element' || undefined}
                onClick={() => setMode((m) => (m === 'element' ? 'idle' : 'element'))}
              >
                Element
              </button>
              <button
                type="button"
                className="rp-btn"
                onClick={() => {
                  setEnabled(false);
                  setMode('idle');
                  setPanelOpen(false);
                }}
                style={{ marginLeft: 4 }}
                title="Turn off review"
              >
                Off
              </button>
            </span>
          </div>
          <div className="rp-panel-tabs">
            <button
              type="button"
              className="rp-tab"
              data-active={tab === 'page' || undefined}
              onClick={() => setTab('page')}
            >
              This page ({review.onPage.length})
            </button>
            <button
              type="button"
              className="rp-tab"
              data-active={tab === 'all' || undefined}
              onClick={() => setTab('all')}
            >
              All ({review.all.length})
            </button>
            <a
              className="rp-tab"
              href="/review"
              style={{ flex: 0, textDecoration: 'none', textAlign: 'center' }}
              title="Open the full review index"
            >
              ↗
            </a>
          </div>
          <div className="rp-panel-body">
            {review.loading && visibleComments.length === 0 && (
              <div className="rp-empty">Loading…</div>
            )}
            {!review.loading && visibleComments.length === 0 && (
              <div className="rp-empty">
                {mode === 'idle'
                  ? 'No comments yet. Switch to Select or Element to start.'
                  : mode === 'select'
                    ? 'Highlight any text on the page to leave a comment.'
                    : 'Hover then click any element to leave a comment.'}
              </div>
            )}
            {visibleComments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                onReply={handleReply}
                onSetStatus={handleSetStatus}
                onRemove={handleRemove}
                onJump={handleJump}
                showPage={tab === 'all'}
                expanded={focusedId === c.id || undefined}
              />
            ))}
          </div>
        </div>
      )}
      {draft && (
        <Composer
          position={draft.position}
          preview={draft.preview}
          onSubmit={submitDraft}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  );
}
