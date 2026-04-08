import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, printSchema } from 'graphql';
import '../src';

describe('plugin-semantic-nullability', () => {
  describe('per-field opt-in', () => {
    const builder = new SchemaBuilder({
      plugins: ['semanticNullability'],
    });

    builder.queryType({
      fields: (t) => ({
        name: t.string({
          nullable: false,
          semanticNonNull: true,
          resolve: () => 'hello',
        }),
        age: t.int({
          nullable: false,
          resolve: () => 42,
        }),
        bio: t.string({
          nullable: true,
          semanticNonNull: true,
          resolve: () => null,
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts non-null field with semanticNonNull to nullable', () => {
      const field = queryType.getFields().name;
      expect(field.type.toString()).toBe('String');
    });

    it('leaves non-null field without semanticNonNull as non-null', () => {
      const field = queryType.getFields().age;
      expect(field.type.toString()).toBe('Int!');
    });

    it('leaves already-nullable field unchanged even with semanticNonNull', () => {
      const field = queryType.getFields().bio;
      expect(field.type.toString()).toBe('String');
      // No directive since there are no non-null levels to convert
      expect(field.extensions?.directives).toBeUndefined();
    });

    it('adds @semanticNonNull directive to extensions', () => {
      const field = queryType.getFields().name;
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: {},
      });
    });

    it('registers the @semanticNonNull directive definition', () => {
      const directive = schema.getDirective('semanticNonNull');
      expect(directive).toBeDefined();
      expect(directive?.name).toBe('semanticNonNull');
    });

    it('generates expected schema', () => {
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });

  describe('list fields with true (level 0 only)', () => {
    const builder = new SchemaBuilder({
      plugins: ['semanticNullability'],
    });

    builder.queryType({
      fields: (t) => ({
        tags: t.stringList({
          nullable: { list: false, items: false },
          semanticNonNull: true,
          resolve: () => ['a', 'b'],
        }),
        nullableItems: t.stringList({
          nullable: { list: false, items: true },
          semanticNonNull: true,
          resolve: () => ['a', null],
        }),
        nullableList: t.stringList({
          nullable: { list: true, items: false },
          semanticNonNull: true,
          resolve: () => ['a'],
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('only converts level 0 for [String!]! — items stay non-null', () => {
      const field = queryType.getFields().tags;
      expect(field.type.toString()).toBe('[String!]');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({ name: 'semanticNonNull', args: {} });
    });

    it('converts level 0 for [String]! — items already nullable', () => {
      const field = queryType.getFields().nullableItems;
      expect(field.type.toString()).toBe('[String]');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({ name: 'semanticNonNull', args: {} });
    });

    it('skips already-nullable level 0 for [String!]', () => {
      const field = queryType.getFields().nullableList;
      expect(field.type.toString()).toBe('[String!]');
      expect(field.extensions?.directives).toBeUndefined();
    });

    it('generates expected schema', () => {
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });

  describe('explicit levels for lists', () => {
    const builder = new SchemaBuilder({
      plugins: ['semanticNullability'],
    });

    builder.queryType({
      fields: (t) => ({
        bothLevels: t.stringList({
          nullable: { list: false, items: false },
          semanticNonNull: [0, 1],
          resolve: () => ['a'],
        }),
        itemsOnly: t.stringList({
          nullable: { list: false, items: false },
          semanticNonNull: [1],
          resolve: () => ['a'],
        }),
        listOnly: t.stringList({
          nullable: { list: false, items: false },
          semanticNonNull: [0],
          resolve: () => ['a'],
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts both levels with [0, 1]', () => {
      const field = queryType.getFields().bothLevels;
      expect(field.type.toString()).toBe('[String]');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: { levels: [0, 1] },
      });
    });

    it('converts only items with [1] — list stays non-null', () => {
      const field = queryType.getFields().itemsOnly;
      expect(field.type.toString()).toBe('[String]!');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: { levels: [1] },
      });
    });

    it('converts only list with [0] — items stay non-null', () => {
      const field = queryType.getFields().listOnly;
      expect(field.type.toString()).toBe('[String!]');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({ name: 'semanticNonNull', args: {} });
    });

    it('generates expected schema', () => {
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });

  describe('schema-wide allNonNullFields', () => {
    const builder = new SchemaBuilder({
      plugins: ['semanticNullability'],
      semanticNullability: {
        allNonNullFields: true,
      },
    });

    builder.queryType({
      fields: (t) => ({
        name: t.string({
          nullable: false,
          resolve: () => 'hello',
        }),
        bio: t.string({
          nullable: true,
          resolve: () => null,
        }),
        age: t.int({
          nullable: false,
          semanticNonNull: false,
          resolve: () => 42,
        }),
        tags: t.stringList({
          nullable: { list: false, items: false },
          resolve: () => ['a'],
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts non-null fields at level 0 by default', () => {
      const field = queryType.getFields().name;
      expect(field.type.toString()).toBe('String');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({ name: 'semanticNonNull', args: {} });
    });

    it('leaves nullable fields unchanged', () => {
      const field = queryType.getFields().bio;
      expect(field.type.toString()).toBe('String');
      expect(field.extensions?.directives).toBeUndefined();
    });

    it('respects per-field opt-out with semanticNonNull: false', () => {
      const field = queryType.getFields().age;
      expect(field.type.toString()).toBe('Int!');
    });

    it('converts list at level 0 only — items stay non-null', () => {
      const field = queryType.getFields().tags;
      expect(field.type.toString()).toBe('[String!]');
      const directives = field.extensions?.directives as DirectiveList;
      expect(directives).toContainEqual({ name: 'semanticNonNull', args: {} });
    });

    it('generates expected schema', () => {
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });
});

type DirectiveList = Array<{ name: string; args: Record<string, unknown> }>;
