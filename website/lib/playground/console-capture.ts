/**
 * Safe console capture utility that handles concurrent captures
 */

export interface ConsoleMessage {
  type: 'log' | 'warn' | 'error' | 'info';
  args: unknown[];
  timestamp: number;
}

// Store the truly original console methods only once
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
};

type ConsoleType = 'log' | 'warn' | 'error' | 'info';

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

  const capture = (type: ConsoleType) => {
    return (...args: unknown[]) => {
      logs.push({
        type,
        args,
        timestamp: Date.now(),
      });
      // Call the original console method
      originalConsole[type](...args);
    };
  };

  // Replace console methods
  const prevLog = console.log;
  const prevWarn = console.warn;
  const prevError = console.error;
  const prevInfo = console.info;

  const ourLog = capture('log');
  const ourWarn = capture('warn');
  const ourError = capture('error');
  const ourInfo = capture('info');

  console.log = ourLog;
  console.warn = ourWarn;
  console.error = ourError;
  console.info = ourInfo;

  try {
    const result = fn();
    return { result, logs };
  } finally {
    // Only restore if our wrapper is still installed; if a nested capture
    // already restored to a previous wrapper, leave it alone — otherwise
    // we'd reinstall a stale wrapper and leak it.
    if (console.log === ourLog) {
      console.log = prevLog;
    }
    if (console.warn === ourWarn) {
      console.warn = prevWarn;
    }
    if (console.error === ourError) {
      console.error = prevError;
    }
    if (console.info === ourInfo) {
      console.info = prevInfo;
    }
  }
}

/**
 * Capture console output during an async operation
 */
export async function captureConsoleAsync<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; logs: ConsoleMessage[] }> {
  const logs: ConsoleMessage[] = [];

  const capture = (type: ConsoleType) => {
    return (...args: unknown[]) => {
      logs.push({
        type,
        args,
        timestamp: Date.now(),
      });
      // Call the original console method
      originalConsole[type](...args);
    };
  };

  // Replace console methods
  const prevLog = console.log;
  const prevWarn = console.warn;
  const prevError = console.error;
  const prevInfo = console.info;

  const ourLog = capture('log');
  const ourWarn = capture('warn');
  const ourError = capture('error');
  const ourInfo = capture('info');

  console.log = ourLog;
  console.warn = ourWarn;
  console.error = ourError;
  console.info = ourInfo;

  try {
    const result = await fn();
    return { result, logs };
  } finally {
    // See sync version for rationale on the equality guard.
    if (console.log === ourLog) {
      console.log = prevLog;
    }
    if (console.warn === ourWarn) {
      console.warn = prevWarn;
    }
    if (console.error === ourError) {
      console.error = prevError;
    }
    if (console.info === ourInfo) {
      console.info = prevInfo;
    }
  }
}
