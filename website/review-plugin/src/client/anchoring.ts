import type { CommentAnchor } from '../types';

/**
 * Anchoring: how we turn a fleeting browser Selection into a string we can
 * round-trip through JSON and re-resolve on the page later.
 *
 * Goals (in priority order):
 *  1. Survive minor edits to surrounding markup — small text changes shouldn't
 *     orphan a comment.
 *  2. Be precise enough to highlight the exact quoted text when it's still
 *     there.
 *  3. Degrade gracefully — if we can't find the exact range, fall back to the
 *     nearest section or heading.
 *
 * Strategy: capture the selected text plus ~32-char prefix/suffix windows from
 * the surrounding text content. On restore, search the page (scoped to the
 * stored selector when possible) for `prefix + quote + suffix`, then narrow.
 * This is the same approach W3C Web Annotations call "TextQuoteSelector".
 */

const CONTEXT_WINDOW = 32;

/** Strip whitespace runs to single spaces for stable context matching. */
function normalize(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Build a CSS selector path from `el` upward, preferring `#id` when present.
 * Stops at the document root or at a content container marker.
 */
function buildSelector(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
    if (cur.id) {
      parts.unshift(`#${CSS.escape(cur.id)}`);
      break;
    }
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const tag = cur.tagName.toLowerCase();
    const tagName: string = cur.tagName;
    const sameTag = Array.from(parent.children).filter(
      (c: Element) => c.tagName === tagName,
    );
    if (sameTag.length === 1) {
      parts.unshift(tag);
    } else {
      const idx = sameTag.indexOf(cur) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
    }
    cur = parent;
  }
  return parts.join(' > ');
}

/** Walks up to find the nearest heading element with an id, for nicer display. */
function nearestHeadingId(el: Element): string | undefined {
  let cur: Element | null = el;
  while (cur) {
    if (/^H[1-6]$/.test(cur.tagName) && cur.id) return cur.id;
    let prev: Element | null = cur.previousElementSibling;
    while (prev) {
      if (/^H[1-6]$/.test(prev.tagName) && prev.id) return prev.id;
      prev = prev.previousElementSibling;
    }
    cur = cur.parentElement;
  }
  return undefined;
}

function getTextOffset(root: Node, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let total = 0;
  let current = walker.nextNode();
  while (current) {
    if (current === node) return total + offset;
    total += current.textContent?.length ?? 0;
    current = walker.nextNode();
  }
  return -1;
}

function elementText(el: Element): string {
  return el.textContent ?? '';
}

export function captureRangeAnchor(
  selection: Selection,
  contentRoot: HTMLElement,
): CommentAnchor | null {
  if (selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (range.collapsed) return null;

  const ancestor = range.commonAncestorContainer;
  const anchorEl = (ancestor.nodeType === 1 ? (ancestor as Element) : ancestor.parentElement)!;
  if (!contentRoot.contains(anchorEl)) return null;

  const quote = range.toString();
  if (!quote.trim()) return null;

  const startOffset = getTextOffset(contentRoot, range.startContainer, range.startOffset);
  const endOffset = getTextOffset(contentRoot, range.endContainer, range.endOffset);
  if (startOffset < 0 || endOffset < 0) return null;

  const fullText = elementText(contentRoot);
  const prefix = fullText.slice(Math.max(0, startOffset - CONTEXT_WINDOW), startOffset);
  const suffix = fullText.slice(endOffset, endOffset + CONTEXT_WINDOW);

  return {
    kind: 'range',
    selector: buildSelector(anchorEl),
    headingId: nearestHeadingId(anchorEl),
    quote,
    prefix,
    suffix,
  };
}

export function captureElementAnchor(target: Element): CommentAnchor {
  const text = normalize(elementText(target)).slice(0, 120);
  return {
    kind: 'element',
    selector: buildSelector(target),
    headingId: nearestHeadingId(target),
    preview: text,
  };
}

export interface ResolvedAnchor {
  range: Range;
  element: Element;
  exact: boolean;
}

/**
 * Resolve a stored anchor back to a live Range. Returns null if nothing
 * plausible was found.
 *
 * For range anchors we try (a) exact `prefix+quote+suffix` match, then
 * (b) `quote+suffix`, (c) `prefix+quote`, and (d) just `quote` if the snippet
 * is long enough to be probably-unique. If all of those miss we fall through
 * to element resolution.
 */
export function resolveAnchor(anchor: CommentAnchor, contentRoot: HTMLElement): ResolvedAnchor | null {
  if (anchor.kind === 'element') {
    const el = contentRoot.querySelector(anchor.selector);
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    return { range, element: el, exact: true };
  }

  const text = elementText(contentRoot);
  const tries = [
    anchor.prefix + anchor.quote + anchor.suffix,
    anchor.quote + anchor.suffix,
    anchor.prefix + anchor.quote,
    anchor.quote.length >= 20 ? anchor.quote : null,
  ].filter((s): s is string => Boolean(s));

  for (const needle of tries) {
    const idx = text.indexOf(needle);
    if (idx === -1) continue;
    const quoteStart = idx + needle.indexOf(anchor.quote);
    const quoteEnd = quoteStart + anchor.quote.length;
    const resolved = rangeFromOffsets(contentRoot, quoteStart, quoteEnd);
    if (resolved) {
      return { range: resolved, element: ancestorElement(resolved), exact: true };
    }
  }

  // Last-resort: jump to the selector ancestor without highlighting a range.
  const fallback = contentRoot.querySelector(anchor.selector);
  if (fallback) {
    const range = document.createRange();
    range.selectNodeContents(fallback);
    return { range, element: fallback, exact: false };
  }
  return null;
}

function ancestorElement(range: Range): Element {
  const node = range.commonAncestorContainer;
  return node.nodeType === 1 ? (node as Element) : node.parentElement!;
}

function rangeFromOffsets(root: Node, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let startNodeOffset = 0;
  let endNode: Text | null = null;
  let endNodeOffset = 0;

  let current = walker.nextNode() as Text | null;
  while (current) {
    const len = current.data.length;
    if (!startNode && consumed + len >= start) {
      startNode = current;
      startNodeOffset = start - consumed;
    }
    if (startNode && consumed + len >= end) {
      endNode = current;
      endNodeOffset = end - consumed;
      break;
    }
    consumed += len;
    current = walker.nextNode() as Text | null;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  try {
    range.setStart(startNode, startNodeOffset);
    range.setEnd(endNode, endNodeOffset);
  } catch {
    return null;
  }
  return range;
}
