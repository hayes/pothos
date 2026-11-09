import {
  experimentalExecuteIncrementally,
  GraphQLStreamDirective,
  parse,
  specifiedDirectives,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import { collectionFromInfo, type Planned } from '../src';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();
type UserRow = Planned<'User'> & { id: string };

function fixture(mode: 'normal' | 'pending' | 'late') {
  let rows: readonly UserRow[] = [];
  let index = 0;
  const started = Promise.withResolvers<void>();
  const closed = Promise.withResolvers<void>();
  const pending = Promise.withResolvers<IteratorResult<UserRow>>();
  const calls = { acquire: 0, next: 0, return: 0 };
  const source: AsyncIterableIterator<UserRow> = {
    [Symbol.asyncIterator]() {
      calls.acquire += 1;
      return this;
    },
    next() {
      calls.next += 1;
      started.resolve();
      if (mode !== 'normal') {
        return pending.promise;
      }
      const row = rows[index++];
      return Promise.resolve(row ? { done: false, value: row } : { done: true, value: undefined });
    },
    return() {
      calls.return += 1;
      closed.resolve();
      if (mode !== 'late') {
        pending.resolve({ done: true, value: undefined });
      }
      return Promise.resolve({ done: true, value: undefined });
    },
  };
  const builder = createBuilder();
  const User = builder.prismaObject('User', {
    fields: (t) => ({ id: t.exposeID('id'), postCount: t.relationCount('posts') }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.field({
        type: [User],
        resolve: async (_parent, _args, context, info) => {
          const users = await collectionFromInfo({
            collection: db.orm.User.orderBy((user) => user.id.asc()),
            context,
            info,
          });
          rows = await users.all();
          return source;
        },
      }),
    }),
  });
  const schema = builder.toSchema(
    mode === 'normal'
      ? {}
      : {
          directives: [...specifiedDirectives, GraphQLStreamDirective],
        },
  );
  const field = schema.getQueryType()!.getFields().users!;
  const resolve = field.resolve!;
  let wrapped: AsyncIterator<unknown> | undefined;
  // Capture the actual built row mapper without starting a source read. GraphQL receives the
  // same iterator, so its stream cancellation still follows the production path.
  field.resolve = async (parent, args, context, info) => {
    const value: unknown = await resolve(parent, args, context, info);
    if (typeof value !== 'object' || value === null || !(Symbol.asyncIterator in value)) {
      throw new Error('Expected an async iterable resolver result.');
    }
    const iterable = value as AsyncIterable<unknown>;
    const iterator = iterable[Symbol.asyncIterator]();
    wrapped = iterator;
    return { [Symbol.asyncIterator]: () => iterator };
  };
  return {
    schema,
    calls,
    started: started.promise,
    closed: closed.promise,
    iterator: () => {
      if (!wrapped?.return) {
        throw new Error('Expected a cancellable row iterator.');
      }
      return wrapped as AsyncIterator<unknown> & Required<Pick<AsyncIterator<unknown>, 'return'>>;
    },
    finishPending: () => pending.resolve({ done: true, value: undefined }),
    deliverLateRow: () => pending.resolve({ done: false, value: rows[0]! }),
  };
}

async function stream(schema: ReturnType<typeof fixture>['schema']) {
  const result = await experimentalExecuteIncrementally({
    schema,
    document: parse('{ users @stream(initialCount: 0) { id postCount } }'),
    contextValue: {},
    enableEarlyExecution: false,
  });
  if (!('initialResult' in result)) {
    throw new Error('Expected an incremental result.');
  }
  expect(result.initialResult.errors).toBeUndefined();
  expect(result.initialResult.data).toEqual({ users: [] });
  return result;
}

async function beforeTimeout<T>(promise: PromiseLike<T>): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), 200);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

describe('async iterable model rows', () => {
  it('maps streamed rows and their planned relation results', async () => {
    const sample = fixture('normal');
    const result = await run(sample.schema, '{ users { id postCount } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      users: [
        { id: 'u-alice', postCount: 2 },
        { id: 'u-bob', postCount: 2 },
      ],
    });
    expect(result.statements).toHaveLength(1);
    expect(sample.calls).toEqual({ acquire: 1, next: 3, return: 0 });
  });

  it('forwards @stream cancellation before the first source read', async () => {
    const sample = fixture('pending');
    const result = await stream(sample.schema);
    expect(sample.calls.next).toBe(0);
    expect(await beforeTimeout(result.subsequentResults.return!())).not.toBe('timeout');
    expect(await beforeTimeout(sample.closed)).not.toBe('timeout');
    expect(sample.calls).toEqual({ acquire: 1, next: 0, return: 1 });
  });

  it('forwards @stream cancellation while a source read is pending', async () => {
    const sample = fixture('pending');
    const result = await stream(sample.schema);
    const reading = result.subsequentResults.next();
    await sample.started;
    try {
      expect(await beforeTimeout(result.subsequentResults.return!())).not.toBe('timeout');
      expect(await beforeTimeout(sample.closed)).not.toBe('timeout');
      expect(sample.calls.return).toBe(1);
      expect((await reading).done).toBe(true);
    } finally {
      sample.finishPending();
      await result.subsequentResults.return?.();
    }
  });

  it('does not emit a row from a read that finishes after cancellation', async () => {
    const sample = fixture('late');
    const result = await stream(sample.schema);
    const iterator = sample.iterator();
    const reading = iterator.next();
    await sample.started;
    try {
      expect(await beforeTimeout(iterator.return())).not.toBe('timeout');
      expect(sample.calls.return).toBe(1);
      sample.deliverLateRow();
      expect((await reading).done).toBe(true);
    } finally {
      sample.finishPending();
      await result.subsequentResults.return?.();
    }
  });
});
