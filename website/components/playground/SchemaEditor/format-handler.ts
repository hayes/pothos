/**
 * Tiny registry that lets the Toolbar's "Format document" overflow item
 * call into the active Monaco editor without leaking globals.
 *
 * SourceEditor calls `setFormatHandler` on mount and clears it on
 * unmount; whoever wants to format calls `runFormatHandler()`.
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
