import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import ZodPlugin, { createZodSchema } from '../src';

describe('zero bounds', () => {
  it('enforces a zero minimum on numbers', async () => {
    const builder = new SchemaBuilder({ plugins: [ZodPlugin] });

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          args: { n: t.arg.int({ required: true, validate: { min: 0 } }) },
          resolve: (_parent, { n }) => n,
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ value(n: -1) }',
      contextValue: {},
    });

    expect(result.errors).toHaveLength(1);
  });

  it('enforces a zero maximum on numbers', async () => {
    const builder = new SchemaBuilder({ plugins: [ZodPlugin] });

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          args: { n: t.arg.int({ required: true, validate: { max: 0 } }) },
          resolve: (_parent, { n }) => n,
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ value(n: 1) }',
      contextValue: {},
    });

    expect(result.errors).toHaveLength(1);
  });

  it('enforces zero length bounds on strings', () => {
    expect(createZodSchema({ type: 'string', maxLength: 0 }, true).safeParse('a').success).toBe(
      false,
    );
    expect(createZodSchema({ type: 'string', minLength: 0 }, true).safeParse('').success).toBe(
      true,
    );
  });

  it('enforces zero length bounds on arrays', () => {
    expect(createZodSchema({ type: 'array', maxLength: 0 }, true).safeParse([1]).success).toBe(
      false,
    );
  });

  it('still enforces zero tuple bounds', () => {
    expect(
      createZodSchema({ type: 'number', min: [0, { message: 'minimum' }] }, true).safeParse(-1)
        .success,
    ).toBe(false);
  });
});
