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
        tags: t.stringList({
          nullable: { list: false, items: false },
          semanticNonNull: true,
          resolve: () => ['a', 'b'],
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts non-null field with semanticNonNull to nullable', () => {
      const nameField = queryType.getFields().name;
      // Should be nullable (no NonNull wrapper)
      expect(nameField.type.toString()).toBe('String');
    });

    it('leaves non-null field without semanticNonNull as non-null', () => {
      const ageField = queryType.getFields().age;
      expect(ageField.type.toString()).toBe('Int!');
    });

    it('leaves already-nullable field unchanged', () => {
      const bioField = queryType.getFields().bio;
      expect(bioField.type.toString()).toBe('String');
    });

    it('converts non-null list field with semanticNonNull to nullable', () => {
      const tagsField = queryType.getFields().tags;
      // Both list and items should be nullable
      expect(tagsField.type.toString()).toBe('[String]');
    });

    it('adds @semanticNonNull directive to extensions for non-null field', () => {
      const nameField = queryType.getFields().name;
      const directives = nameField.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: {},
      });
    });

    it('adds @semanticNonNull with levels for list field', () => {
      const tagsField = queryType.getFields().tags;
      const directives = tagsField.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: { levels: [0, 1] },
      });
    });

    it('does not add directive to already-nullable field', () => {
      const bioField = queryType.getFields().bio;
      const directives = bioField.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      // Should have no directives since the field was already nullable
      expect(directives).toBeUndefined();
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
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts all non-null fields by default', () => {
      const nameField = queryType.getFields().name;
      expect(nameField.type.toString()).toBe('String');
      const directives = nameField.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: {},
      });
    });

    it('leaves nullable fields unchanged', () => {
      const bioField = queryType.getFields().bio;
      expect(bioField.type.toString()).toBe('String');
    });

    it('respects per-field opt-out with semanticNonNull: false', () => {
      const ageField = queryType.getFields().age;
      expect(ageField.type.toString()).toBe('Int!');
    });

    it('generates expected schema', () => {
      expect(printSchema(schema)).toMatchSnapshot();
    });
  });

  describe('list with partial nullability', () => {
    const builder = new SchemaBuilder({
      plugins: ['semanticNullability'],
    });

    builder.queryType({
      fields: (t) => ({
        listNullableItems: t.stringList({
          nullable: { list: false, items: true },
          semanticNonNull: true,
          resolve: () => ['a', null],
        }),
        nullableListNonNullItems: t.stringList({
          nullable: { list: true, items: false },
          semanticNonNull: true,
          resolve: () => ['a'],
        }),
      }),
    });

    const schema = builder.toSchema();
    const queryType = schema.getType('Query') as GraphQLObjectType;

    it('converts list with non-null list, nullable items - only level 0', () => {
      const field = queryType.getFields().listNullableItems;
      expect(field.type.toString()).toBe('[String]');
      const directives = field.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: {},
      });
    });

    it('converts list with nullable list, non-null items - only level 1', () => {
      const field = queryType.getFields().nullableListNonNullItems;
      expect(field.type.toString()).toBe('[String]');
      const directives = field.extensions?.directives as Array<{
        name: string;
        args: Record<string, unknown>;
      }>;
      expect(directives).toContainEqual({
        name: 'semanticNonNull',
        args: { levels: [1] },
      });
    });
  });
});
