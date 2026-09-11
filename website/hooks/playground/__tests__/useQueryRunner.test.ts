import { GraphQLObjectType, GraphQLScalarType, GraphQLSchema } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { states } = vi.hoisted(() => ({ states: [] as unknown[] }));
vi.mock('react', () => ({
  useRef: (initial: unknown) => ({ current: initial }),
  useCallback: (callback: unknown) => callback,
  useState: (initial: unknown) => {
    const index = states.length;
    states.push(initial);
    return [
      initial,
      (next: unknown) => {
        states[index] = next;
      },
    ];
  },
}));
vi.mock('@/lib/playground/active-query-cursor', () => ({ getQueryCursor: () => null }));
vi.mock('@/lib/playground/console-capture', () => ({
  captureConsoleAsync: async (fn: () => Promise<unknown>) => ({ result: await fn(), logs: [] }),
}));
vi.mock('@/lib/playground/error-message', () => ({ errorMessage: (err: Error) => err.message }));
vi.mock('@/lib/playground/extension-panels-slot', () => ({
  getExtensionPanels: () => [],
  resetExtensionPanels: () => {},
}));
vi.mock('@/lib/playground/playground-panels', () => ({ isExtensionPanel: () => false }));

import { useQueryRunner } from '../useQueryRunner';

beforeEach(() => {
  states.length = 0;
});

describe('query failure recovery', () => {
  it('reports a custom scalar serialization failure and allows another run', async () => {
    const schema = new GraphQLSchema({
      query: new GraphQLObjectType({
        name: 'Query',
        fields: {
          value: {
            type: new GraphQLScalarType({ name: 'Custom', serialize: (value) => value }),
            resolve: () => 1n,
          },
        },
      }),
    });
    const runner = useQueryRunner();
    const result = await runner.run({ schema, query: '{ value }', variables: '' });
    expect(result.phase.kind).toBe('error');
    expect(states[0]).toEqual(result.phase);
    expect(result.phase).toMatchObject({ body: expect.stringMatching(/BigInt/i) });
    const next = await runner.run({ schema, query: '{ __typename }', variables: '' });
    expect(next.phase.kind).toBe('success');
  });

  it('reports execution rejection for an invalid schema', async () => {
    const runner = useQueryRunner();
    const result = await runner.run({
      schema: {} as GraphQLSchema,
      query: '{ value }',
      variables: '',
    });
    expect(result.phase.kind).toBe('error');
    expect(states[0]).toEqual(result.phase);
    expect(states[1]).toEqual([]);
    expect(states[2]).toEqual([]);
  });
});

it('coalesces overlapping runs so a mutation executes once', async () => {
  let finish!: (value: unknown) => void;
  const resolve = vi.fn(
    () =>
      new Promise((done) => {
        finish = done;
      }),
  );
  const schema = new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        value: {
          type: new GraphQLScalarType({ name: 'Custom', serialize: (value) => value }),
          resolve,
        },
      },
    }),
  });
  const runner = useQueryRunner();
  const args = { schema, query: '{ value }', variables: '' };
  const first = runner.run(args);
  const second = runner.run(args);
  expect(first).toBe(second);
  expect(resolve).toHaveBeenCalledTimes(1);
  finish('done');
  expect((await first).phase.kind).toBe('success');
});
