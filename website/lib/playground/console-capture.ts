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
 * Capture console output during a synchronous or asynchronous operation
 */
export function captureConsole<T>(fn: () => T): { result: T; logs: ConsoleMessage[] } {
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

  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');
  console.info = capture('info');

  try {
    const result = fn();
    return { result, logs };
  } finally {
    // Restore previous console methods
    console.log = prevLog;
    console.warn = prevWarn;
    console.error = prevError;
    console.info = prevInfo;
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

  console.log = capture('log');
  console.warn = capture('warn');
  console.error = capture('error');
  console.info = capture('info');

  try {
    const result = await fn();
    return { result, logs };
  } finally {
    // Restore previous console methods
    console.log = prevLog;
    console.warn = prevWarn;
    console.error = prevError;
    console.info = prevInfo;
  }
}
