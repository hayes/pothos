/**
 * Centralized configuration for the Pothos Playground
 *
 * This file contains all magic numbers, timeouts, and configuration values
 * used throughout the playground to improve maintainability and consistency.
 */

export const PLAYGROUND_CONFIG = {
  // Compilation timeouts
  /** Debounce delay for auto-compilation when typing (ms) */
  DEBOUNCE_MS: 500,

  /** Maximum time for TypeScript compilation (ms) */
  COMPILATION_TIMEOUT_MS: 30000,

  /** Maximum time for schema execution/building (ms) */
  EXECUTION_TIMEOUT_MS: 5000,

  // Caching
  /** Maximum age for cached compiled schemas (ms) - 7 days */
  CACHE_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,

  /** Maximum number of entries in memory cache fallback */
  MAX_MEMORY_CACHE_SIZE: 50,

  // External Resources
  /** CDN URL for esbuild WASM binary */
  ESBUILD_WASM_URL: 'https://unpkg.com/esbuild-wasm@0.27.1/esbuild.wasm',

  // UI Timeouts
  /** How long to show "copied" status after copying (ms) */
  SHARE_STATUS_TIMEOUT_MS: 2000,

  /** Maximum time to wait for Monaco editor to load (ms) */
  MONACO_LOAD_TIMEOUT_MS: 15000,

  /** Debounce delay for plugin type loading in Monaco (ms) */
  PLUGIN_LOAD_DEBOUNCE_MS: 500,

  // Feature Flags
  /** Enable web worker for TypeScript compilation */
  ENABLE_WORKER_COMPILATION: true,

  /** Enable IndexedDB caching for compiled schemas */
  ENABLE_CACHE: true,

  /** Enable console log capture during execution */
  ENABLE_CONSOLE_LOGS: true,

  // IndexedDB
  /** IndexedDB database name */
  DB_NAME: 'pothos-playground',

  /** IndexedDB object store name for schema cache */
  STORE_NAME: 'schema-cache',

  /** IndexedDB database version */
  DB_VERSION: 1,
} as const;

export type PlaygroundConfig = typeof PLAYGROUND_CONFIG;

/**
 * Get a configuration value by key
 * Useful for dynamic config access with type safety
 */
export function getConfig<K extends keyof PlaygroundConfig>(key: K): PlaygroundConfig[K] {
  return PLAYGROUND_CONFIG[key];
}
