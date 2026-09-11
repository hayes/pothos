/**
 * Safe console capture utility that handles concurrent captures
 */

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: number;
}

const consoleTypes = ['log', 'warn', 'error', 'info'] as const;
const captures: Array<{ logs: ConsoleMessage[] }> = [];
let restoreConsole: (() => void) | null = null;

function beginCapture(logs: ConsoleMessage[]): () => void {
  const capture = { logs };
  if (captures.length === 0) {
    const restorers = consoleTypes.map((type) => {
      const previous = console[type];
      const wrapper = (...args: unknown[]) => {
        captures[captures.length - 1]?.logs.push({ type, args, timestamp: Date.now() });
        previous.apply(console, args);
      };
      console[type] = wrapper;
      return () => {
        if (console[type] === wrapper) {
          console[type] = previous;
        }
      };
    });
    restoreConsole = () =>
      restorers.forEach((restore) => {
        restore();
      });
  }
  captures.push(capture);
  return () => {
    captures.splice(captures.indexOf(capture), 1);
    if (captures.length === 0) {
      restoreConsole?.();
      restoreConsole = null;
    }
  };
}

/**
 * Capture console output during a synchronous operation. Pass an
 * optional `out` array to read accumulated logs even when `fn` throws —
 * the array is mutated in place, so the caller can inspect it from a
 * surrounding catch.
 */
export function captureConsole<T>(
  fn: () => T,
  out?: ConsoleMessage[],
): { result: T; logs: ConsoleMessage[] } {
  const logs = out ?? [];
  const finish = beginCapture(logs);
  try {
    return { result: fn(), logs };
  } finally {
    finish();
  }
}

/**
 * Capture console output during an async operation
 */
export async function captureConsoleAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; logs: ConsoleMessage[] }> {
  const logs: ConsoleMessage[] = [];
  const finish = beginCapture(logs);
  try {
    return { result: await fn(), logs };
  } finally {
    finish();
  }
}
