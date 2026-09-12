import SchemaBuilder from '@pothos/core';
import type { GraphQLObjectType } from 'graphql';
import DirectivesPlugin from '../src';

describe('unordered directives', () => {
  it('merges repeated directives from extensions with directive options without nesting args', () => {
    const builder = new SchemaBuilder<{
      Directives: {
        tag: { locations: 'FIELD_DEFINITION'; args: { value: string } };
      };
    }>({
      plugins: [DirectivesPlugin],
      directives: { useGraphQLToolsUnorderedDirectives: true },
    });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          extensions: { directives: { tag: [{ value: 'a' }, { value: 'b' }] } },
          directives: [{ name: 'tag', args: { value: 'c' } }],
          resolve: () => '',
        }),
      }),
    });

    const field = (builder.toSchema().getQueryType() as GraphQLObjectType).getFields().hello;

    expect(field.extensions.directives).toEqual({
      tag: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
    });
  });
});
