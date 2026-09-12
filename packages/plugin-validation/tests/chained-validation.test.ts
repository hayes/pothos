import SchemaBuilder from '@pothos/core';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import * as zod from 'zod';
import '../src';

function createBuilder() {
  return new SchemaBuilder<{
    Scalars: {
      ID: { Input: bigint | number | string; Output: bigint | number | string };
    };
  }>({
    plugins: ['validation'],
    validation: {},
  });
}

const addOne = zod.object({ n: zod.number() }).transform(({ n }) => ({ n: n + 1 }));
const timesTwo = zod.object({ n: zod.number() }).transform(({ n }) => ({ n: n * 2 }));

describe('Chained validation', () => {
  describe('input object chains', () => {
    it('executes chained input type schemas in declaration order', async () => {
      const builder = createBuilder();

      const Input = builder
        .inputType('Input', {
          fields: (t) => ({
            n: t.int({ required: true }),
          }),
        })
        .validate(addOne)
        .validate(timesTwo);

      builder.queryType({
        fields: (t) => ({
          value: t.int({
            args: {
              input: t.arg({ type: Input, required: true }),
            },
            resolve: (_root, args) => args.input.n,
          }),
        }),
      });

      const result = await execute({
        schema: builder.toSchema(),
        document: gql`
          query {
            value(input: { n: 2 })
          }
        `,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      // (2 + 1) * 2, not (2 * 2) + 1
      expect(result.data?.value).toBe(6);
    });
  });
});
