import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, getNamedType } from 'graphql';
import { vi } from 'vitest';
import RelayPlugin from '../src';

it.each([
  false,
  true,
])('closes async connection edges promptly (read started: %s)', async (started) => {
  let settle: (result: IteratorResult<unknown>) => void = () => {};
  const edges: AsyncIterableIterator<unknown> = {
    next: vi.fn(
      () =>
        new Promise<IteratorResult<unknown>>((resolve) => {
          settle = resolve;
        }),
    ),
    return: vi.fn(() => {
      const result = { value: undefined, done: true };
      settle(result);
      return Promise.resolve(result);
    }),
    [Symbol.asyncIterator]() {
      return this;
    },
  };
  const builder = new SchemaBuilder({ plugins: [RelayPlugin], relay: { nodesOnConnection: true } });
  builder.queryType({
    fields: (t) => ({
      items: t.connection({ type: 'String', resolve: () => ({ edges }) as never }),
    }),
  });
  const schema = builder.toSchema();
  const connection = getNamedType(
    schema.getQueryType()!.getFields().items.type,
  ) as GraphQLObjectType;
  const iterator = connection.getFields().nodes.resolve!(
    { edges },
    {},
    {},
    {} as never,
  ) as AsyncIterable<unknown>;
  const mapped = iterator[Symbol.asyncIterator]();
  const pending = started ? mapped.next() : undefined;
  const closing = mapped.return!();
  try {
    expect(edges.return).toHaveBeenCalledOnce();
  } finally {
    await edges.return!();
    await Promise.all([pending, closing]);
  }
  if (pending) {
    expect((await pending).done).toBe(true);
  }
});
