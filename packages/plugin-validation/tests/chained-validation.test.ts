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

  describe('input type validate option combined with chained schemas', () => {
    it('keeps chained schemas when the input type has a validate option', async () => {
      const builder = createBuilder();

      const Input = builder
        .inputType('Input', {
          fields: (t) => ({
            n: t.int({ required: true }),
          }),
          validate: timesTwo,
        })
        .validate(addOne);

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
      // chained schemas run in declaration order, then the options schema,
      // consistent with input fields and arguments: (2 + 1) * 2
      expect(result.data?.value).toBe(6);
    });

    it('still applies chained constraints when the input type has a validate option', async () => {
      const builder = createBuilder();

      const Input = builder
        .inputType('Input', {
          fields: (t) => ({
            n: t.int({ required: true }),
          }),
          validate: zod.object({ n: zod.number() }),
        })
        .validate(zod.object({ n: zod.number().min(2) }));

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
            value(input: { n: 1 })
          }
        `,
        contextValue: {},
      });

      expect(result.data?.value).toBeNull();
      expect(result.errors?.map((error) => error.message)).toMatchInlineSnapshot(`
        [
          "Validation error: input.n: Too small: expected number to be >=2",
        ]
      `);
    });
  });
});
