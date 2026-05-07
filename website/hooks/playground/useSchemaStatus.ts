'use client';

import { useMemo } from 'react';
import type { SchemaStatus } from '../../components/playground/Toolbar/StatusPill';
import type { CompilerState } from '../../lib/playground/use-playground-compiler';

interface Args {
  state: CompilerState;
  /** What to do when the user clicks the error pill. */
  onErrorClick?: () => void;
}

const ERR_LOCATION_RE = /^([^:]+):(\d+):(\d+)/;

function summarize(error: string): { count: number; description: string } {
  const lines = error.split('\n').filter(Boolean);
  const description = lines[0] ?? 'Schema build failed';
  const match = description.match(ERR_LOCATION_RE);
  const where = match ? `in ${match[1]}` : 'in schema';
  return { count: 1, description: `1 error ${where}` };
}

export function useSchemaStatus({ state, onErrorClick }: Args): SchemaStatus {
  return useMemo<SchemaStatus>(() => {
    if (state.error) {
      const summary = summarize(state.error);
      return {
        kind: 'error',
        text: summary.description,
        onClick: onErrorClick,
      };
    }
    if (state.isCompiling) {
      return { kind: 'compiling', text: 'compiling…' };
    }
    if (!state.schema) {
      return { kind: 'idle', text: 'schema not ready' };
    }
    const fieldCount = countFields(state);
    return {
      kind: 'idle',
      text: `schema synced · 0 errors · ${fieldCount} field${fieldCount === 1 ? '' : 's'}`,
    };
  }, [state, onErrorClick]);
}

function countFields(state: CompilerState): number {
  if (!state.schema) {
    return 0;
  }
  let total = 0;
  for (const t of Object.values(state.schema.getTypeMap())) {
    if (t.name.startsWith('__')) {
      continue;
    }
    if ('getFields' in t && typeof t.getFields === 'function') {
      total += Object.keys(t.getFields()).length;
    }
  }
  return total;
}
