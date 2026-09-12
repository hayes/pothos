import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import { GraphQLInputObjectType, graphql, validateSchema } from 'graphql';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { type GiraffeLookup, schema } from './schema';

const source = readFileSync(new URL('./query.graphql', import.meta.url), 'utf8');

describe('OneOf input guide', () => {
  it('infers a union with exactly one non-null member', () => {
    expectTypeOf<typeof GiraffeLookup.$inferInput>().toEqualTypeOf<
      { id: string; name?: never } | { name: string; id?: never }
    >();
  });

  it.each([{ id: '1' }, { name: 'Gina' }])('looks up %j', async (by) => {
    expect(await graphql({ schema, source, variableValues: { by } })).toEqual({
      data: { giraffeName: 'Gina' },
    });
  });

  it.each([
    {},
    { id: '1', name: 'Gina' },
    { id: null },
    null,
    undefined,
  ])('rejects %j before calling the resolver', async (by) => {
    const field = schema.getQueryType()!.getFields().giraffeName;
    const resolve = vi.spyOn(field, 'resolve');
    try {
      const result = await graphql({
        schema,
        source,
        variableValues: by === undefined ? {} : { by },
      });
      expect(result.errors).toHaveLength(1);
      expect(result.data).toBeUndefined();
      expect(resolve).not.toHaveBeenCalled();
    } finally {
      resolve.mockRestore();
    }
  });

  it.each([
    '{}',
    '{ id: "1", name: "Gina" }',
    '{ id: null }',
  ])('rejects invalid inline input %s', async (by) => {
    const result = await graphql({ schema, source: `{ giraffeName(by: ${by}) }` });
    expect(result.errors).toHaveLength(1);
    expect(result.data).toBeUndefined();
  });

  it('allows explicit optional members with globally required inputs', () => {
    const builder = new SchemaBuilder<{ DefaultInputFieldRequiredness: true }>({
      defaultInputFieldRequiredness: true,
    });
    const by = builder.inputType('RequiredByDefaultLookup', {
      isOneOf: true,
      fields: (t) => ({
        id: t.id({ required: false }),
        name: t.string({ required: false }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        lookup: t.string({ args: { by: t.arg({ type: by }) }, resolve: () => 'Gina' }),
      }),
    });
    const configured = builder.toSchema();
    expect(validateSchema(configured)).toEqual([]);
    const input = configured.getType('RequiredByDefaultLookup');
    expect(input).toBeInstanceOf(GraphQLInputObjectType);
    expect((input as GraphQLInputObjectType).isOneOf).toBe(true);
  });
});
