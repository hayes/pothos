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
  if (value === null || typeof value !== 'object') {
    // Primitives (number, boolean, bigint, symbol, function, undefined).
    return String(value);
  }
  // Objects: JSON with a circular-safe replacer. A resolver logging a
  // circular object — or `console.log` of a DOM/Event value — must never
  // fall through to `String(value)` and surface as "[object Object]".
  const seen = new WeakSet<object>();
  try {
    const json = JSON.stringify(value, (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return '[Circular]';
        }
        seen.add(val);
      }
      if (typeof val === 'bigint') {
        return `${val}n`;
      }
      if (typeof val === 'function') {
        return `[Function: ${(val as { name?: string }).name || 'anonymous'}]`;
      }
      return val;
    });
    // `undefined` (e.g. a lone symbol) or a bare `{}` from a non-plain
    // object (Event, DOM node) → fall back to a readable label instead.
    if (json === undefined || (json === '{}' && !isPlainRecord(value))) {
      return describeObject(value);
    }
    return json;
  } catch {
    return describeObject(value);
  }
}

function isPlainRecord(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function describeObject(value: object): string {
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  const tag = Object.prototype.toString.call(value).slice(8, -1);
  return `[${ctor && ctor !== 'Object' ? ctor : tag}]`;
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
