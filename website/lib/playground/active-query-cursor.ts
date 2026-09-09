'use client';

// The Monaco QueryEditor writes its current caret offset here on every
// cursor change. When the Run button or Cmd+Enter fires, the runner
// reads this to decide which operation to execute in a multi-operation
// file (e.g. `04-args/query.graphql` ships three named queries in a
// single document — graphql-js refuses to run that without an explicit
// `operationName`).
//
// A module-level singleton is fine here: only one query editor is ever
// mounted at a time in this UI. Switching subtabs unmounts/remounts the
// editor; the next cursor event repopulates the offset.

let cursorOffset: number | null = null;

export function setQueryCursor(offset: number | null): void {
  cursorOffset = offset;
}

export function getQueryCursor(): number | null {
  return cursorOffset;
}
