---
name: review-docs
description: Interactive docs-site review loop. Starts the docs dev server (if not already running), watches the review-feedback file, and replies to each new comment inline — asking clarifying questions when needed and proposing fixes when not. Use when the user wants to walk the docs site leaving comments anywhere on the page and have Claude respond to them as they come in. Triggers include "/review-docs", "review the docs", "walk through the docs", "comment-driven docs review".
allowed-tools: Bash, Read, Edit, Write, AskUserQuestion, ScheduleWakeup, Agent
---

# review-docs

A comment-driven review loop for this repo's docs site.

You and the user are pair-reviewing the docs. The user navigates the running
dev site and drops comments via the **Review** toolbar (bottom-right). Each
comment lands in `.claude/review-feedback.json` at the repo root. Your job is
to read new comments, reply to them, and ask clarifying questions when the
intent isn't clear — all without the user leaving the browser.

## Repo conventions

- **Storage file**: `.claude/review-feedback.json` (gitignored).
- **Dev server**: `pnpm --filter @pothos/website dev` from the repo root.
  Listens on `http://localhost:3000`.
- **Docs content**: lives under `website/content/docs/**/*.mdx`. The page URL
  `/docs/fundamentals/fields` maps to
  `website/content/docs/fundamentals/fields.mdx`.
- **Index page**: `http://localhost:3000/review` lists every comment with a
  link back to its source page.

## On entry

1. **Read the feedback file.** If it doesn't exist yet, create it as
   `{"version":1,"comments":[]}` so the rest of the loop has something to
   parse.
   ```bash
   cat .claude/review-feedback.json 2>/dev/null || echo '{"version":1,"comments":[]}'
   ```
2. **Make sure the dev server is up.**
   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/review
   ```
   - `200` → already running, continue.
   - Anything else → start it in the background:
     ```bash
     # Run with run_in_background=true
     pnpm --filter @pothos/website dev
     ```
     Then poll the same `/api/review` endpoint until it returns 200 before
     telling the user the server is ready.
3. **Greet the user** with a single sentence: the URL to open, the number of
   pending comments (if any), and a reminder that you'll watch for new ones.

## The review loop

Process every comment whose `status === "open"` and whose `replies` array does
not already contain a reply with `author === "claude"`. For each such comment:

1. **Identify the page.** `comment.page` is the URL path. Map it to the MDX
   file under `website/content/docs/`. If the page URL doesn't resolve to a
   single MDX file, fall back to grepping for the quoted text (
   `comment.anchor.quote` for `kind: "range"` anchors).
2. **Read the relevant section.** Use the `headingId` and the quoted text to
   locate the exact paragraph in source. Pull in enough surrounding context
   to understand what the user is reacting to.
3. **Decide whether you can act.** A comment is **actionable** when you
   understand what change is being requested and can make it confidently.
   Otherwise treat it as **needs clarification**.
4. **Reply.** PATCH the comment via the local API so the response appears
   inline for the user:
   ```bash
   curl -sS -X PATCH http://localhost:3000/api/review/<comment-id> \
     -H 'content-type: application/json' \
     -d '{"addReply":{"author":"claude","body":"<your reply>"}}'
   ```
   - When **actionable**, propose the fix in the reply (don't apply it yet —
     ask if they want it applied, or if you've already inferred consent from
     the conversation, mention you've applied it and what changed).
   - When **needs clarification**, also set `status: "needs-clarification"`
     in the same PATCH, and write the question. Optionally use
     `AskUserQuestion` to surface the question more loudly, but don't block
     the loop on it — the user will answer in the browser as a reply.
5. **If the user has replied since your last visit** (any reply with
   `author !== "claude"` whose `createdAt` is after your last claude reply),
   treat that as a fresh round: re-read, re-decide, re-reply.

## Pacing

After each pass through pending comments, call `ScheduleWakeup` with a
`delaySeconds` of `60` and the same prompt that started the loop, so the
next wake re-enters this skill. End the loop when:

- The user types something that doesn't fit (treat as a normal request).
- Every comment is either `resolved`, `wontfix`, or has a claude reply that
  the user has not responded to.
- The user explicitly says "stop" / "done reviewing" / "exit review".

When ending, post one final summary message: how many comments were processed,
how many are still waiting on the user, and a link to
`http://localhost:3000/review`.

## Edge cases

- **File is locked or write fails.** The dev server writes atomically via
  rename, but a concurrent skill write could race. On failure, sleep 250ms
  and retry once before reporting.
- **No quoted text** (`anchor.kind === "element"`). Use the `selector` plus
  the `preview` snippet to locate the block — grep the preview text or the
  heading id.
- **Page no longer exists.** Reply explaining the page was removed and set
  status to `wontfix`.
- **User asks a question via reply that wasn't on a comment you can directly
  fix** (e.g., "what's the convention here?"). Answer it directly; don't
  pretend it's an actionable doc edit.

## Don't

- **Don't auto-apply code changes** without either an explicit user ask or
  unambiguous "please fix this" feedback. Propose first; let the user confirm.
- **Don't echo the full comment text** in your reply. The user wrote it and
  can see it; respond to the question, don't restate it.
- **Don't reformat the JSON file by hand.** Always go through the API so the
  atomic write semantics are preserved.
