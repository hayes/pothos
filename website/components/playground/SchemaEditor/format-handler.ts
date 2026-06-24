/**
 * Tiny registry that lets the Toolbar's "Format document" overflow item
 * call into the active Monaco editor without leaking globals.
 *
 * SourceEditor calls `setFormatHandler` on mount and clears it on
 * unmount; whoever wants to format calls `runFormatHandler()`.
 *
 * TODO(state-agent): page.tsx still reads
 * `(window as ...).__monacoFormatHandler` for the "Format document"
 * overflow item. Replace that with a direct `runFormatHandler()` call
 * from this module — SourceEditor already wires the registry below.
 */

type Handler = () => void;

let current: Handler | null = null;

export function setFormatHandler(handler: Handler | null): void {
  current = handler;
}

export function runFormatHandler(): void {
  current?.();
}

export function hasFormatHandler(): boolean {
  return current !== null;
}
