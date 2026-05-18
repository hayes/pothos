export type ResponsePhase =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; status: number; durationMs: number; sizeBytes: number; body: string }
  | { kind: 'error'; status: number; durationMs: number; errorCount: number; body: string };

/**
 * Active sub-tab in the ResponsePane. `'response'` is the built-in body
 * editor; any other string keys a panel surfaced via
 * `extensions.playgroundPanels` (the panel's `name` becomes the key).
 */
export type ResponseSubTab = string;
