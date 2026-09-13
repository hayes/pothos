import SchemaBuilder from '@pothos/core';
import type { GraphQLSchema } from 'graphql';
import { expectTypeOf } from 'vitest';
import DirectivesPlugin from '../src';

describe('directive types', () => {
  it('accepts directives with multiple locations in the ordered (array) format', () => {
    const builder = new SchemaBuilder<{
      Directives: {
        multi: { locations: 'FIELD_DEFINITION' | 'OBJECT'; args: { name: string } };
      };
    }>({
      plugins: [DirectivesPlugin],
    });

    builder.queryType({
      directives: [{ name: 'multi', args: { name: 'root' } }],
      fields: (t) => ({
        hello: t.string({
          directives: [{ name: 'multi', args: { name: 'field' } }],
          resolve: () => '',
        }),
      }),
    });

    expectTypeOf(builder.toSchema()).toEqualTypeOf<GraphQLSchema>();
  });
});
