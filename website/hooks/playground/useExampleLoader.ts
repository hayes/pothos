'use client';

import { useCallback, useRef, useState } from 'react';
import {
  type ExampleMetadata,
  exampleMetadata,
  getExample,
  type Step,
} from '@/components/playground/examples';
import type { Operation } from '@/components/playground/OperationPane/types';
import type { PlaygroundFile } from '@/components/playground/types';
import { makeOperation } from './useOperations';

interface QueryShape {
  title?: string;
  query: string;
  variables?: string;
}

export interface LoadedExample {
  /** The base example metadata (without `-step-N` suffix). */
  metadata: ExampleMetadata;
  /** Steps for the base example, used to drive the StepperBar. */
  steps: Step[];
  /** ID of the base example, e.g. `errors-plugin`. Stable across step changes. */
  baseId: string;
}

export interface ExampleLoaderResult {
  files: PlaygroundFile[];
  operations: Operation[];
  defaultActive: number;
}

export interface ExampleLoaderState {
  loaded: LoadedExample | null;
  stepIndex: number;
  loading: boolean;
  load: (id: string) => Promise<ExampleLoaderResult | null>;
  /** Move to a step within the currently loaded example. */
  goToStep: (index: number) => Promise<ExampleLoaderResult | null>;
  exit: () => void;
}

const STEP_SUFFIX = /-step-\d+$/;

function baseIdFor(id: string): string {
  return id.replace(STEP_SUFFIX, '');
}

function findMetadataById(id: string): ExampleMetadata | undefined {
  return exampleMetadata.find((m) => m.id === id);
}

function operationsFromExample(
  defaultQuery: string,
  queries: readonly QueryShape[] | undefined,
): Operation[] {
  if (queries && queries.length > 0) {
    return queries.map((q, i) =>
      makeOperation({
        name: q.title ?? `Operation-${i + 1}`,
        query: q.query,
        variables: q.variables ?? '',
      }),
    );
  }
  return [makeOperation({ query: defaultQuery, variables: '' })];
}

function stepIndexFromId(id: string, steps: Step[]): number {
  const match = id.match(/-step-(\d+)$/);
  if (!match) {
    return 0;
  }
  const stepId = `step-${match[1]}`;
  const idx = steps.findIndex((s) => s.id === stepId);
  return idx >= 0 ? idx : 0;
}

export function useExampleLoader(): ExampleLoaderState {
  const [loaded, setLoaded] = useState<LoadedExample | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  // Mirror of `loaded` that updates synchronously inside `load`. During
  // the URL bootstrap, `load(id)` and `goToStep(n)` run in the same tick:
  // the `setLoaded` state write hasn't flushed yet, so a closure over
  // `loaded` would still read `null` and the requested step would never
  // load (opening `?example=…&step=2` cold always landed on step 1).
  // Reading the ref lets `goToStep` see the just-loaded example.
  const loadedRef = useRef<LoadedExample | null>(null);

  const load = useCallback(async (id: string): Promise<ExampleLoaderResult | null> => {
    setLoading(true);
    try {
      const ex = await getExample(id);
      if (!ex) {
        return null;
      }

      // The id we're loading may be a step variant (e.g. `errors-plugin-step-1`).
      // The "base" example metadata (with the steps array) lives under the id
      // without the suffix, e.g. `errors-plugin`.
      const base = baseIdFor(id);
      const baseMeta = findMetadataById(base);
      const steps = baseMeta?.steps ?? ex.steps ?? [];

      const meta =
        baseMeta ??
        ({
          id: base,
          title: ex.title,
          description: ex.description,
          tags: ex.tags ?? [],
          steps,
        } as ExampleMetadata);

      const nextLoaded: LoadedExample = { metadata: meta, steps, baseId: base };
      loadedRef.current = nextLoaded;
      setLoaded(nextLoaded);
      setStepIndex(stepIndexFromId(id, steps));

      const operations = operationsFromExample(ex.defaultQuery, ex.queries);
      // `defaultActiveFile` (set per-step via metadata) lets a step
      // open with the most relevant file focused — e.g. a "relations"
      // step focuses `models/user.ts`. Falls back to index 0.
      return { files: ex.files, operations, defaultActive: ex.defaultActiveFile ?? 0 };
    } finally {
      setLoading(false);
    }
  }, []);

  const goToStep = useCallback(
    (index: number): Promise<ExampleLoaderResult | null> => {
      // Read from the ref (not the `loaded` state) so this works even
      // when called in the same tick as `load` during URL bootstrap.
      const current = loadedRef.current;
      if (!current) {
        return Promise.resolve(null);
      }
      const step = current.steps[index];
      if (!step) {
        return Promise.resolve(null);
      }
      // Each step has its own bundle: `${baseId}-${step.id}`.
      const stepId = `${current.baseId}-${step.id}`;
      return load(stepId);
    },
    [load],
  );

  const exit = useCallback(() => {
    loadedRef.current = null;
    setLoaded(null);
    setStepIndex(0);
  }, []);

  return { loaded, stepIndex, loading, load, goToStep, exit };
}
