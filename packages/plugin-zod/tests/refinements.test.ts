import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import ZodPlugin, { createZodSchema } from '../src';

describe('refinement arrays', () => {
  it('runs every bare function in a refinement array', async () => {
    const builder = new SchemaBuilder({ plugins: [ZodPlugin] });
    const calls: string[] = [];

    builder.queryType({
      fields: (t) => ({
        value: t.int({
          args: {
            n: t.arg.int({
              required: true,
              validate: {
                refine: [
                  (n) => {
                    calls.push('first');
                    return n > 0;
                  },
                  (n) => {
                    calls.push('second');
                    return n < 2;
                  },
                ],
              },
            }),
          },
          resolve: (_parent, { n }) => n,
        }),
      }),
    });

    const result = await graphql({
      schema: builder.toSchema(),
      source: '{ value(n: 3) }',
      contextValue: {},
    });

    expect(calls).toEqual(['first', 'second']);
    expect(result.errors).toHaveLength(1);
  });

  it('allows tuple and bare refinements in the same array', () => {
    const validator = createZodSchema(
      {
        refine: [
          [(value: unknown) => value !== 'a', { message: 'not a' }],
          (value: unknown) => value !== 'b',
        ],
      },
      true,
    );

    expect(validator.safeParse('a').error?.issues[0].message).toBe('not a');
    expect(validator.safeParse('b').success).toBe(false);
    expect(validator.safeParse('c').success).toBe(true);
  });

  it('still treats a single refinement tuple as one refinement', () => {
    const validator = createZodSchema({
      refine: [(value: unknown) => value !== 'a', { message: 'not a' }],
    });

    expect(validator.safeParse('a').error?.issues[0].message).toBe('not a');
    expect(validator.safeParse('b').success).toBe(true);
  });
});
