'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConsoleLogEntry, ConsoleLogKind } from '@/components/playground/ConsoleDrawer/types';
import type { ConsoleMessage } from '@/lib/playground/execution-engine';

let logIdCounter = 0;
const nextLogId = () => `log_${Date.now()}_${++logIdCounter}`;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}

function stringifyArg(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function toEntry(msg: ConsoleMessage, source: 'compile' | 'query'): ConsoleLogEntry {
  return {
    id: nextLogId(),
    kind: msg.type as ConsoleLogKind,
    timestamp: formatTime(Date.now()),
    message: msg.args.map(stringifyArg).join(' '),
    source,
  };
}

export interface ConsoleLogsState {
  logs: ConsoleLogEntry[];
  errorCount: number;
  push: (msgs: ConsoleMessage[], source: 'compile' | 'query') => void;
  /** Replace all compile-source entries with the given fresh batch. */
  replaceCompile: (msgs: ConsoleMessage[], compileError: string | null) => void;
  clear: () => void;
}

export function useConsoleLogs(): ConsoleLogsState {
  const [logs, setLogs] = useState<ConsoleLogEntry[]>([]);
  const compileSeenRef = useRef<string>('');

  const push = useCallback((msgs: ConsoleMessage[], source: 'compile' | 'query') => {
    if (msgs.length === 0) {
      return;
    }
    setLogs((prev) => [...prev, ...msgs.map((m) => toEntry(m, source))]);
  }, []);

  const replaceCompile = useCallback((msgs: ConsoleMessage[], compileError: string | null) => {
    setLogs((prev) => prev.filter((l) => l.source !== 'compile'));
    const entries = msgs.map((m) => toEntry(m, 'compile'));
    if (compileError) {
      entries.push({
        id: nextLogId(),
        kind: 'error',
        timestamp: formatTime(Date.now()),
        message: compileError,
        source: 'compile',
      });
    }
    if (entries.length > 0) {
      setLogs((prev) => [...prev, ...entries]);
    }
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  // Avoid re-pushing the same compile snapshot on every render.
  useEffect(() => {
    compileSeenRef.current = '';
  }, []);

  const errorCount = logs.reduce((acc, l) => acc + (l.kind === 'error' ? 1 : 0), 0);

  return { logs, errorCount, push, replaceCompile, clear };
}
