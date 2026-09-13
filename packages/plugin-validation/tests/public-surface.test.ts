import SchemaBuilder from '@pothos/core';
import { graphql } from 'graphql';
import { z } from 'zod';
import ValidationPlugin from '../src';

it('exposes validation chains on inputs without advertising output validation', async () => {
  const builder = new SchemaBuilder({ plugins: [ValidationPlugin] });
  builder.queryType({
    fields: (t) => {
      const field = t.string({
        args: { value: t.arg.string({ required: true }).validate(z.string().trim()) },
        resolve: (_parent, { value }) => value,
      });
      // @ts-expect-error Output fields do not support result validation.
      expect(field.validate).toBeUndefined();
      return { echo: field };
    },
  });
  const result = await graphql({
    schema: builder.toSchema(),
    source: '{ echo(value: "  hello  ") }',
  });
  expect(result.errors).toBeUndefined();
  expect(result.data).toEqual({ echo: 'hello' });
});
