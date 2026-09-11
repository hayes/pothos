export type ConsoleLogKind = 'log' | 'info' | 'warn' | 'error';

export interface ConsoleLogEntry {
  id: string;
  kind: ConsoleLogKind;
  /** Wall-clock time formatted as `HH:MM:SS` (filled when entry is recorded). */
  timestamp: string;
  message: string;
  /** Optional source — `compile` or `query`. */
  source?: 'compile' | 'query';
}

export type ConsoleFilter = 'all' | 'errors' | 'warnings' | 'logs';
