import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import { z } from 'zod';
import ValidationPlugin from '../src';

it.each([
  false,
  true,
])('transforms omitted and null arguments (async: %s)', async (asyncTransform) => {
  const builder = new SchemaBuilder({ plugins: [ValidationPlugin] });
  builder.queryType({
    fields: (t) => ({
      value: t.string({
        args: {
          input: t.arg.string().validate(
            z
              .string()
              .nullish()
              .transform((value) =>
                asyncTransform ? Promise.resolve(value ?? 'fallback') : (value ?? 'fallback'),
              ),
          ),
        },
        resolve: (_, args) => args.input.toUpperCase(),
      }),
    }),
  });
  const schema = builder.toSchema();
  for (const source of ['{ value }', '{ value(input: null) }']) {
    expect(await graphql({ schema, source, contextValue: {} })).toEqual({
      data: { value: 'FALLBACK' },
    });
  }
});

it('validates nullish input fields and list arguments through their chains', async () => {
  const builder = new SchemaBuilder({ plugins: [ValidationPlugin] });
  const Input = builder.inputType('Input', {
    fields: (t) => ({
      name: t.string().validate(
        z
          .string()
          .nullish()
          .transform((value) => value ?? 'fallback'),
      ),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      value: t.string({
        args: {
          input: t.arg({ type: Input, required: true }),
          names: t.arg.stringList().validate(
            z
              .array(z.string())
              .nullish()
              .transform((value) => value ?? ['default']),
          ),
        },
        resolve: (_, { input, names }) => `${input.name.toUpperCase()}:${names.join(',')}`,
      }),
    }),
  });
  const schema = builder.toSchema();
  for (const source of ['{ value(input: {}) }', '{ value(input: { name: null }, names: null) }']) {
    expect(await graphql({ schema, source, contextValue: {} })).toEqual({
      data: { value: 'FALLBACK:default' },
    });
  }
});

it('rejects nullish values when a chained schema requires a string', async () => {
  const builder = new SchemaBuilder({ plugins: [ValidationPlugin] });
  let resolved = false;
  builder.queryType({
    fields: (t) => ({
      value: t.string({
        args: { input: t.arg.string().validate(z.string()) },
        resolve: (_, { input }) => {
          resolved = true;
          return input;
        },
      }),
    }),
  });
  const schema = builder.toSchema();
  for (const source of ['{ value }', '{ value(input: null) }']) {
    const result = await graphql({ schema, source, contextValue: {} });
    expect(result.errors?.[0].message).toMatch('Validation error: input:');
    expect(resolved).toBe(false);
  }
});

it('keeps option validators optional but validates values produced by a chain', async () => {
  const builder = new SchemaBuilder({ plugins: [ValidationPlugin] });
  const Input = builder.inputType('Input', {
    fields: (t) => ({ name: t.string({ validate: z.string().min(2) }) }),
  });
  builder.queryType({
    fields: (t) => ({
      value: t.string({
        args: {
          input: t.arg({ type: Input }),
          plain: t.arg.string({ validate: z.string().min(2) }),
          chained: t.arg.string({ validate: z.string().min(2) }).validate(
            z
              .string()
              .nullish()
              .transform((value) => value ?? 'x'),
          ),
        },
        resolve: () => 'resolved',
      }),
    }),
  });
  const schema = builder.toSchema();
  expect(
    await graphql({
      schema,
      source: '{ value(input: { name: null }, plain: null, chained: "ok") }',
      contextValue: {},
    }),
  ).toEqual({ data: { value: 'resolved' } });
  const result = await graphql({ schema, source: '{ value }', contextValue: {} });
  expect(result.errors?.[0].message).toMatch('Validation error: chained:');
});
