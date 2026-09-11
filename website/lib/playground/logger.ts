/**
 * Debug logger utility for the Pothos Playground
 *
 * Provides controlled logging with debug mode support and namespace prefixes.
 * Debug mode can be enabled via localStorage: localStorage.setItem('DEBUG_PLAYGROUND', 'true')
 */

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Check if debug mode is enabled
 * Debug can be enabled in production via localStorage for troubleshooting
 */
function isDebugEnabled(): boolean {
  if (IS_DEV) {
    return true; // Always debug in development
  }

  // Check localStorage flag for production debugging
  if (typeof window !== 'undefined') {
    try {
      return window.localStorage?.getItem('DEBUG_PLAYGROUND') === 'true';
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Main logger instance with namespace support
 */
export const logger = {
  /**
   * Debug logs - only shown in development or when DEBUG_PLAYGROUND=true
   */
  debug: (...args: unknown[]) => {
    if (isDebugEnabled()) {
      console.log('[Playground]', ...args);
    }
  },

  /**
   * Info logs - always shown
   */
  info: (...args: unknown[]) => {
    console.info('[Playground]', ...args);
  },

  /**
   * Warning logs - always shown
   */
  warn: (...args: unknown[]) => {
    console.warn('[Playground]', ...args);
  },

  /**
   * Error logs - always shown
   */
  error: (...args: unknown[]) => {
    console.error('[Playground]', ...args);
  },
};

/**
 * Create a namespaced logger
 * Useful for creating loggers for specific subsystems
 *
 * @example
 * const compilerLogger = createLogger('Compiler');
 * compilerLogger.debug('Compiling schema...');
 * // Output: [Playground:Compiler] Compiling schema...
 */
export function createLogger(namespace: string) {
  return {
    debug: (...args: unknown[]) => {
      if (isDebugEnabled()) {
        console.log(`[Playground:${namespace}]`, ...args);
      }
    },

    info: (...args: unknown[]) => {
      console.info(`[Playground:${namespace}]`, ...args);
    },

    warn: (...args: unknown[]) => {
      console.warn(`[Playground:${namespace}]`, ...args);
    },

    error: (...args: unknown[]) => {
      console.error(`[Playground:${namespace}]`, ...args);
    },
  };
}

/**
 * Specialized loggers for common subsystems
 */
export const compilerLogger = createLogger('Compiler');
export const monacoLogger = createLogger('Monaco');
export const cacheLogger = createLogger('Cache');
export const clipboardLogger = createLogger('Clipboard');
export const shareLogger = createLogger('Share');

/**
 * Enable debug mode programmatically
 * Useful for troubleshooting in production
 */
export function enableDebugMode(): void {
  if (typeof window !== 'undefined') {
    window.localStorage?.setItem('DEBUG_PLAYGROUND', 'true');
    console.info('[Playground] Debug mode enabled. Reload to see debug logs.');
  }
}

/**
 * Disable debug mode
 */
export function disableDebugMode(): void {
  if (typeof window !== 'undefined') {
    window.localStorage?.removeItem('DEBUG_PLAYGROUND');
    console.info('[Playground] Debug mode disabled.');
  }
}
