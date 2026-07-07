# review-plugin

A self-contained, dev-only feedback overlay for Next.js docs sites. Drop a floating
toolbar onto any page, let a reviewer highlight text or click sections to attach
comments, and read everything back from a single JSON file. Pairs with the
`/review-docs` Claude Code skill, which watches the file and replies inline.

This plugin is intentionally generic. It knows nothing about Pothos, fumadocs,
MDX, or the rest of this site — it only needs a Next.js App Router host, React
19+, and a place to store JSON on disk.

## Wiring

### 1. API route shim

```ts
// app/api/review/[[...path]]/route.ts
import { createReviewRouteHandlers } from "@/review-plugin/server";

export const dynamic = "force-dynamic";
export const { GET, POST, PATCH, DELETE } = createReviewRouteHandlers();
```

`createReviewRouteHandlers` 404s in production. To override the file location
(default `<repoRoot>/.claude/review-feedback.json`), pass `{ storagePath }`.

### 2. Mount the overlay

```tsx
// app/(docs)/layout.tsx
import { ReviewProviderDevOnly } from "@/review-plugin/client";

export default function Layout({ children }) {
  return (
    <>
      {children}
      <ReviewProviderDevOnly />
    </>
  );
}
```

`ReviewProviderDevOnly` resolves to a no-op component in production builds
(checked at module load via `process.env.NODE_ENV`), so the entire client bundle
gets dead-code-eliminated.

### 3. Optional index page

```tsx
// app/review/page.tsx
import { ReviewIndexPage } from "@/review-plugin/client";
export default ReviewIndexPage;
```

## Storage format

A single JSON file containing an object:

```jsonc
{
  "version": 1,
  "comments": [
    {
      "id": "cmt_…",
      "page": "/docs/guide/fields",
      "anchor": { … },
      "body": "this paragraph is confusing",
      "author": "user",
      "createdAt": "2026-…",
      "status": "open",
      "replies": [{ "id": "rep_…", "author": "claude", "body": "…", "createdAt": "…" }]
    }
  ]
}
```

The schema is stable and append-friendly — agents can read/write it without
needing to load any plugin code.
