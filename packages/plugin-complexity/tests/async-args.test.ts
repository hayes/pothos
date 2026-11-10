import SchemaBuilder, { isThenable } from '@pothos/core';
import ValidationPlugin, { type StandardSchemaV1 } from '@pothos/plugin-validation';
import { executeSync, graphql, parse, specifiedRules, subscribe, validate } from 'graphql';
import { vi } from 'vitest';
import ComplexityPlugin, { complexityFromQuery, createComplexityRule } from '../src';

const query = '{ items(first: 100) { value } }';
const mappingError =
  'createComplexityRule does not support asynchronous complexity calculations; await complexityFromQuery before execution instead';

function createSchema(
  mode: 'sync' | 'async' | 'reject' = 'async',
  dynamic = true,
  transform: (value: number) => number = (value) => value,
) {
  const builder = new SchemaBuilder({
    plugins: [ComplexityPlugin, ValidationPlugin],
    complexity: { limit: { complexity: 50 } },
  });
  const Item = builder.objectRef<{ value: number }>('Item').implement({
    fields: (t) => ({ value: t.exposeInt('value') }),
  });
  const validator: StandardSchemaV1<number> = {
    '~standard': {
      version: 1,
      vendor: 'test',
      validate: (value) => {
        if (mode === 'reject') {
          return Promise.reject(new Error('validation failed'));
        }
        const result = { value: transform(value as number) };
        return mode === 'async' ? Promise.resolve(result) : result;
      },
    },
  };
  const complexity = vi.fn((args: { first: number }) => ({ multiplier: args.first }));
  const resolve = vi.fn((_: unknown, args: { first: number }) =>
    Array.from({ length: args.first }, () => ({ value: 1 })),
  );
  builder.queryType({
    fields: (t) => ({
      items: t.field({
        type: [Item],
        args: { first: t.arg.int({ required: true, validate: validator }) },
        complexity: dynamic ? complexity : { field: 1, multiplier: 1 },
        resolve,
      }),
    }),
  });
  const startSubscription = vi.fn(async function* () {
    yield await Promise.resolve({});
  });
  builder.subscriptionType({
    fields: (t) => ({
      items: t.field({
        type: [Item],
        args: { first: t.arg.int({ required: true, validate: validator }) },
        complexity: dynamic ? complexity : { field: 1, multiplier: 1 },
        subscribe: startSubscription,
        resolve,
      }),
    }),
  });
  return { schema: builder.toSchema(), complexity, resolve, startSubscription };
}

it('calculates complexity after asynchronous argument mapping', async () => {
  const { schema } = createSchema();
  expect(await complexityFromQuery(query, { schema })).toEqual({
    complexity: 101,
    breadth: 2,
    depth: 2,
  });
});

it('reports unsupported argument mapping through the validation rule', () => {
  const { schema, complexity } = createSchema();
  const errors = validate(schema, parse(query), [
    ...specifiedRules,
    createComplexityRule({ context: {}, variableValues: {}, maxComplexity: 50 }),
  ]);
  expect(errors.map((error) => error.message)).toEqual([mappingError]);
  expect(complexity).not.toHaveBeenCalled();
});

it('rejects expensive execution after mapping and before its resolver', async () => {
  const { schema, complexity, resolve } = createSchema();
  const result = await graphql({ schema, source: query, contextValue: {} });
  expect(result.errors?.[0].message).toContain('maximum complexity');
  expect(complexity).toHaveBeenCalled();
  expect(resolve).not.toHaveBeenCalled();
});

it('propagates asynchronous mapper failures from the helper and runtime', async () => {
  const { schema, resolve } = createSchema('reject');
  await expect(complexityFromQuery(query, { schema })).rejects.toThrow('validation failed');
  const result = await graphql({ schema, source: query, contextValue: {} });
  expect(result.errors?.[0].message).toBe('validation failed');
  expect(resolve).not.toHaveBeenCalled();
});

it('consumes mapper rejections when synchronous validation cannot await them', async () => {
  const { schema } = createSchema('reject');
  const onResult = vi.fn();
  const customValidate = vi.fn();
  const errors = validate(schema, parse(query), [
    createComplexityRule({
      context: {},
      variableValues: {},
      validate: customValidate,
      onResult,
    }),
  ]);
  expect(errors.map((error) => error.message)).toEqual([mappingError]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(onResult).not.toHaveBeenCalled();
  expect(customValidate).not.toHaveBeenCalled();
});

it('continues to calculate and enforce costs using synchronously mapped arguments', async () => {
  const { schema, complexity, resolve } = createSchema('sync');
  const calculated = complexityFromQuery(query, { schema });
  expect(isThenable(calculated)).toBe(false);
  if (isThenable(calculated)) {
    throw new Error('Expected synchronous complexity');
  }
  expect(calculated.complexity).toBe(101);
  expect(complexity).toHaveBeenCalledWith(
    { first: 100 },
    {},
    schema.getQueryType()!.getFields().items,
  );
  const result = await graphql({ schema, source: query, contextValue: {} });
  expect(result.errors?.[0].message).toContain('maximum complexity');
  expect(resolve).not.toHaveBeenCalled();
});

it('allows asynchronous validation when the field has a static complexity', async () => {
  const { schema, resolve } = createSchema('async', false);
  const calculated = complexityFromQuery(query, { schema });
  expect(isThenable(calculated)).toBe(false);
  expect(await calculated).toEqual({ complexity: 2, depth: 2, breadth: 2 });
  const result = await graphql({ schema, source: query, contextValue: {} });
  expect(result.errors).toBeUndefined();
  expect(resolve).toHaveBeenCalledOnce();
  expect(result.data?.items).toHaveLength(100);
});

it('keeps executeSync working for synchronous mapped arguments', () => {
  const { schema } = createSchema('sync');
  const result = executeSync({
    schema,
    document: parse('{ items(first: 2) { value } }'),
    contextValue: {},
  });
  expect(result).toEqual({ data: { items: [{ value: 1 }, { value: 1 }] } });
});

it('uses transformed async arguments for calculation and affordable execution', async () => {
  const { schema, resolve } = createSchema('async', true, (value) => value * 3);
  const source = '{ items(first: 2) { value } }';
  expect(await complexityFromQuery(source, { schema })).toEqual({
    complexity: 7,
    depth: 2,
    breadth: 2,
  });
  const result = await graphql({ schema, source, contextValue: {} });
  expect(result.errors).toBeUndefined();
  expect(result.data?.items).toHaveLength(6);
  expect(resolve.mock.calls[0][1]).toEqual({ first: 6 });
});

it('rejects transformed expensive subscription arguments before acquiring its source', async () => {
  const { schema, startSubscription } = createSchema('async', true, (value) => value * 100);
  const result = await subscribe({
    schema,
    document: parse('subscription { items(first: 1) { value } }'),
    contextValue: {},
  });
  expect(Symbol.asyncIterator in result).toBe(false);
  if (Symbol.asyncIterator in result) {
    throw new Error('Expected complexity failure');
  }
  expect(result.errors?.[0].message).toContain('maximum complexity');
  expect(startSubscription).not.toHaveBeenCalled();
});

it('allows an affordable async subscription and checks its events', async () => {
  const { schema, startSubscription } = createSchema('async', true, (value) => value * 2);
  const result = await subscribe({
    schema,
    document: parse('subscription { items(first: 2) { value } }'),
    contextValue: {},
  });
  expect(Symbol.asyncIterator in result).toBe(true);
  if (!(Symbol.asyncIterator in result)) {
    throw new Error('Expected subscription');
  }
  const iterator = result[Symbol.asyncIterator]();
  expect((await iterator.next()).value).toEqual({
    data: { items: [{ value: 1 }, { value: 1 }, { value: 1 }, { value: 1 }] },
  });
  expect(startSubscription).toHaveBeenCalledOnce();
  await iterator.return?.();
});

it('memoizes repeated fragments across async traversal and detects cycles after awaiting', async () => {
  const { schema, complexity } = createSchema();
  const fragments = ['fragment F0 on Query { items(first: 1) { value } }'];
  for (let i = 1; i <= 20; i += 1) {
    fragments.push(`fragment F${i} on Query { ...F${i - 1} ...F${i - 1} }`);
  }
  expect(await complexityFromQuery(`query { ...F20 } ${fragments.join('\n')}`, { schema })).toEqual(
    { complexity: 2 ** 21, breadth: 2 ** 21, depth: 2 },
  );
  expect(complexity).toHaveBeenCalledOnce();
  await expect(
    complexityFromQuery('query { ...A } fragment A on Query { items(first: 1) { value } ...A }', {
      schema,
    }),
  ).rejects.toThrow('cyclic fragment');
});

it('shares one pending operation calculation across concurrent root fields', async () => {
  const { schema, complexity, resolve } = createSchema();
  const result = await graphql({
    schema,
    source: '{ a: items(first: 2) { value } b: items(first: 3) { value } }',
    contextValue: {},
  });
  expect(result.errors).toBeUndefined();
  expect(result.data?.a).toHaveLength(2);
  expect(result.data?.b).toHaveLength(3);
  expect(complexity).toHaveBeenCalledTimes(2);
  expect(resolve).toHaveBeenCalledTimes(2);
});
