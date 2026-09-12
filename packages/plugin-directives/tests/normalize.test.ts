import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, print } from 'graphql';
import DirectivesPlugin from '../src';

function orderedBuilder() {
  return new SchemaBuilder<{
    Directives: {
      tag: { locations: 'FIELD_DEFINITION'; args: { value: string } };
    };
  }>({
    plugins: [DirectivesPlugin],
  });
}

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

  it('supports directives named after Object.prototype members', () => {
    const builder = new SchemaBuilder<{
      Directives: {
        constructor: { locations: 'OBJECT'; args: {} };
      };
    }>({
      plugins: [DirectivesPlugin],
      directives: { useGraphQLToolsUnorderedDirectives: true },
    });

    builder.queryType({
      directives: [{ name: 'constructor', args: {} }],
      fields: (t) => ({
        ok: t.boolean({ resolve: () => true }),
      }),
    });

    const queryType = builder.toSchema().getQueryType() as GraphQLObjectType;

    expect(queryType.extensions.directives).toEqual({ constructor: [{}] });
  });
});

describe('ordered directives', () => {
  it('expands repeated args from extensions when there are no directive options to merge', () => {
    const builder = orderedBuilder();

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          extensions: { directives: { tag: [{ value: 'a' }, { value: 'b' }] } },
          resolve: () => '',
        }),
      }),
    });

    const field = (builder.toSchema().getQueryType() as GraphQLObjectType).getFields().hello;

    expect(field.extensions.directives).toEqual([
      { name: 'tag', args: { value: 'a' } },
      { name: 'tag', args: { value: 'b' } },
    ]);
    expect(print(field.astNode!)).toBe('hello: String @tag(value: "a") @tag(value: "b")');
  });

  it('keeps the single-args record form unchanged', () => {
    const builder = orderedBuilder();

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          extensions: { directives: { tag: { value: 'a' } } },
          resolve: () => '',
        }),
      }),
    });

    const field = (builder.toSchema().getQueryType() as GraphQLObjectType).getFields().hello;

    expect(field.extensions.directives).toEqual([{ name: 'tag', args: { value: 'a' } }]);
    expect(print(field.astNode!)).toBe('hello: String @tag(value: "a")');
  });

  it('drops a directive with no repeated args', () => {
    const builder = orderedBuilder();

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          extensions: { directives: { tag: [] } },
          resolve: () => '',
        }),
      }),
    });

    const field = (builder.toSchema().getQueryType() as GraphQLObjectType).getFields().hello;

    expect(field.extensions.directives).toEqual([]);
    expect(print(field.astNode!)).toBe('hello: String');
  });
});
