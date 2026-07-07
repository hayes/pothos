/**
 * Public data model for the review plugin. The shape on disk is a thin wrapper
 * around `Comment[]`; everything else (anchoring, transport) is derived from
 * these types.
 *
 * The schema is intentionally stable and minimal so external tools (a Claude
 * skill, a CLI, a CI bot) can read or write the file directly without pulling
 * in any of the plugin's code.
 */

export type CommentAuthor = 'user' | 'claude' | string;
export type CommentStatus = 'open' | 'needs-clarification' | 'resolved' | 'wontfix';

/**
 * Anchors a comment to a specific span of content on a page.
 *
 * - `kind: "range"` — the reviewer selected text. We capture the quote plus a
 *   short context window so the range can be re-located even if surrounding
 *   markup shifts.
 * - `kind: "element"` — the reviewer clicked a block (heading, paragraph,
 *   code block). Less precise but survives more aggressive edits.
 *
 * Both variants store a `selector` pointing at a stable ancestor (something
 * with an id, or a CSS path to the closest stable element) and an optional
 * `headingId` for nicer display.
 */
export type CommentAnchor =
  | {
      kind: 'range';
      selector: string;
      headingId?: string;
      quote: string;
      prefix: string;
      suffix: string;
    }
  | {
      kind: 'element';
      selector: string;
      headingId?: string;
      preview: string;
    };

export interface CommentReply {
  id: string;
  author: CommentAuthor;
  body: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  /** App-relative URL path the comment was filed against, e.g. `/docs/guide/fields`. */
  page: string;
  /** Display title captured at creation time — useful for the index page. */
  pageTitle?: string;
  anchor: CommentAnchor;
  body: string;
  author: CommentAuthor;
  createdAt: string;
  status: CommentStatus;
  replies: CommentReply[];
}

export interface ReviewFile {
  version: 1;
  comments: Comment[];
}

/** Wire-level payloads for the route handler. */
export interface CreateCommentInput {
  page: string;
  pageTitle?: string;
  anchor: CommentAnchor;
  body: string;
  author?: CommentAuthor;
}

export interface UpdateCommentInput {
  status?: CommentStatus;
  body?: string;
  addReply?: { author: CommentAuthor; body: string };
}
