import SchemaBuilder from '@pothos/core';
import { execute, parse, validate } from 'graphql';
import ComplexityPlugin, { complexityFromQuery, createComplexityRule } from '../src';

describe('renamed operation roots', () => {
  it('checks complexity against the schema root type when the query root is renamed', async () => {
    const builder = new SchemaBuilder({
      plugins: [ComplexityPlugin],
      complexity: { limit: { complexity: 10 } },
    });

    builder.queryType({
      name: 'Root',
      fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ hello }'),
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ hello: 'hello' });
  });

  it('resolves the root type by operation for complexityFromQuery', () => {
    const builder = new SchemaBuilder({ plugins: [ComplexityPlugin] });

    builder.queryType({
      name: 'Root',
      fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }),
    });

    expect(complexityFromQuery('{ hello }', { schema: builder.toSchema() })).toEqual({
      complexity: 1,
      depth: 1,
      breadth: 1,
    });
  });
});

describe('zero limits', () => {
  it('enforces a complexity limit of 0', async () => {
    const builder = new SchemaBuilder({
      plugins: [ComplexityPlugin],
      complexity: { limit: { complexity: 0 } },
    });

    builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }) });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ hello }'),
      contextValue: {},
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors?.[0].message).toBe(
      'Query exceeds maximum complexity (complexity: 1, max: 0)',
    );
  });
});

describe('schema level options', () => {
  it('honors `disabled` passed to toSchema', async () => {
    const builder = new SchemaBuilder({
      plugins: [ComplexityPlugin],
      complexity: { limit: { complexity: 1 } },
    });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({ resolve: () => 'hello' }),
        other: t.string({ resolve: () => 'other' }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema({ complexity: { disabled: true } }),
      document: parse('{ hello other }'),
      contextValue: {},
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ hello: 'hello', other: 'other' });
  });
});

describe('validation rule', () => {
  it('measures each operation independently', () => {
    const builder = new SchemaBuilder({ plugins: [ComplexityPlugin] });

    builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }) });

    const schema = builder.toSchema();

    const errors = validate(schema, parse('query A { hello } query B { hello }'), [
      createComplexityRule({ context: {}, variableValues: {}, maxComplexity: 1 }),
    ]);

    expect(errors).toEqual([]);
  });

  it('reports per-operation results to onResult', () => {
    const builder = new SchemaBuilder({ plugins: [ComplexityPlugin] });

    builder.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }) });

    const schema = builder.toSchema();
    const results: { complexity: number; depth: number; breadth: number }[] = [];

    validate(schema, parse('query A { hello } query B { hello }'), [
      createComplexityRule({
        context: {},
        variableValues: {},
        onResult: (result) => {
          results.push({ ...result });
        },
      }),
    ]);

    expect(results).toEqual([
      { complexity: 1, depth: 1, breadth: 1 },
      { complexity: 1, depth: 1, breadth: 1 },
    ]);
  });
});
