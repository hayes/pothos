export type ResponsePhase =
  | { kind: 'idle' }
  | { kind: 'pending' }
  | { kind: 'success'; status: number; durationMs: number; sizeBytes: number; body: string }
  | { kind: 'error'; status: number; durationMs: number; errorCount: number; body: string };

export interface TraceRow {
  /** Path through the operation, e.g. `Query.user`, `User.posts`. */
  path: string;
  /** Self time in ms (used for the bar fill width). */
  selfMs: number;
  /** Display string like `8.1 ms` or `0.0 ms × 2`. */
  totalLabel: string;
  /** Resolver function name. */
  resolver: string;
}

export type ResponseSubTab = 'response' | 'trace';
