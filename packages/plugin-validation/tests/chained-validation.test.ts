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

  describe('transforms that return null', () => {
    it('continues the chain after a schema transforms a value to null', async () => {
      const builder = createBuilder();

      builder.queryType({
        fields: (t) => ({
          value: t.int({
            args: {
              n: t.arg
                .int({ required: true })
                .validate(zod.number().transform(() => null))
                .validate(zod.null().transform(() => 7)),
            },
            resolve: (_root, args) => args.n,
          }),
        }),
      });

      const result = await execute({
        schema: builder.toSchema(),
        document: gql`
          query {
            value(n: 2)
          }
        `,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.value).toBe(7);
    });

    it('continues the chain after an async schema transforms a value to null', async () => {
      const builder = createBuilder();

      builder.queryType({
        fields: (t) => ({
          value: t.int({
            args: {
              n: t.arg
                .int({ required: true })
                .validate(zod.number().transform(() => Promise.resolve(null)))
                .validate(zod.null().transform(() => Promise.resolve(7))),
            },
            resolve: (_root, args) => args.n,
          }),
        }),
      });

      const result = await execute({
        schema: builder.toSchema(),
        document: gql`
          query {
            value(n: 2)
          }
        `,
        contextValue: {},
      });

      expect(result.errors).toBeUndefined();
      expect(result.data?.value).toBe(7);
    });

    it('still reports issues from a schema that rejects a null transform result', async () => {
      const builder = createBuilder();

      builder.queryType({
        fields: (t) => ({
          value: t.int({
            args: {
              n: t.arg
                .int({ required: true })
                .validate(zod.number().transform(() => null))
                .validate(zod.number()),
            },
            resolve: (_root, args) => args.n,
          }),
        }),
      });

      const result = await execute({
        schema: builder.toSchema(),
        document: gql`
          query {
            value(n: 2)
          }
        `,
        contextValue: {},
      });

      expect(result.data?.value).toBeNull();
      expect(result.errors?.map((error) => error.message)).toMatchInlineSnapshot(`
        [
          "Validation error: n: Invalid input: expected number, received null",
        ]
      `);
    });
  });
});
