'use client';

import { useCallback, useState } from 'react';
import type {
  HeaderEntry,
  Operation,
  OperationSubTab,
} from '@/components/playground/OperationPane/types';

const nextOpId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `op_${crypto.randomUUID()}`
    : `op_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const OP_NAME_RE = /\b(query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/;

export function parseOperationName(query: string, fallback: string): string {
  const match = query.match(OP_NAME_RE);
  return match?.[2] ?? fallback;
}

export function makeOperation(input?: Partial<Operation>): Operation {
  const query = input?.query ?? '';
  return {
    id: input?.id ?? nextOpId(),
    name: input?.name ?? parseOperationName(query, 'Untitled-1'),
    query,
    variables: input?.variables ?? '',
    headers: input?.headers ?? [],
    context: input?.context ?? '',
    dirty: input?.dirty ?? false,
  };
}

export interface OperationsState {
  operations: Operation[];
  activeIndex: number;
  subTab: OperationSubTab;
  active: Operation;

  setOperations: (ops: Operation[]) => void;
  setActiveIndex: (index: number) => void;
  setSubTab: (tab: OperationSubTab) => void;

  setQuery: (next: string) => void;
  setVariables: (next: string) => void;
  setHeaders: (next: HeaderEntry[]) => void;
  setContext: (next: string) => void;

  addOperation: () => void;
  closeOperation: (index: number) => void;
  markClean: () => void;
}

export function useOperations(initial: Operation[]): OperationsState {
  const [operations, setOperations] = useState<Operation[]>(initial);
  const [activeIndex, setActiveIndex] = useState(0);
  const [subTab, setSubTab] = useState<OperationSubTab>('query');

  const active = operations[activeIndex] ?? operations[0];

  const replaceActive = useCallback(
    (patch: Partial<Operation>) => {
      setOperations((prev) =>
        prev.map((op, i) => (i === activeIndex ? { ...op, ...patch, dirty: true } : op)),
      );
    },
    [activeIndex],
  );

  const setQuery = useCallback(
    (next: string) =>
      replaceActive({
        query: next,
        name: parseOperationName(next, active?.name ?? 'Untitled'),
      }),
    [active?.name, replaceActive],
  );

  const setVariables = useCallback(
    (next: string) => replaceActive({ variables: next }),
    [replaceActive],
  );

  const setHeaders = useCallback(
    (next: HeaderEntry[]) => replaceActive({ headers: next }),
    [replaceActive],
  );

  const setContext = useCallback(
    (next: string) => replaceActive({ context: next }),
    [replaceActive],
  );

  const addOperation = useCallback(() => {
    setOperations((prev) => {
      const fallback = `Untitled-${prev.length + 1}`;
      const op = makeOperation({ name: fallback, query: '', variables: '' });
      const next = [...prev, op];
      setActiveIndex(next.length - 1);
      return next;
    });
    setSubTab('query');
  }, []);

  const closeOperation = useCallback((index: number) => {
    setOperations((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      const next = prev.filter((_, i) => i !== index);
      setActiveIndex((cur) =>
        cur === index ? Math.max(0, index - 1) : cur > index ? cur - 1 : cur,
      );
      return next;
    });
  }, []);

  const markClean = useCallback(() => {
    setOperations((prev) => prev.map((op) => ({ ...op, dirty: false })));
  }, []);

  return {
    operations,
    activeIndex,
    subTab,
    active: active ?? makeOperation(),
    setOperations,
    setActiveIndex,
    setSubTab,
    setQuery,
    setVariables,
    setHeaders,
    setContext,
    addOperation,
    closeOperation,
    markClean,
  };
}
