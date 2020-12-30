import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';
import {
  nullableFieldBuilder,
  nonNullableFieldBuilder,
} from './examples/default-field-nullability';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});

describe('Field Nullability', () => {
  test('generates expected schema', () => {
    const nullableFieldSchema = printSchema(
      lexicographicSortSchema(nullableFieldBuilder.toSchema({})),
    );
    const nonNullableFieldSchema = printSchema(
      lexicographicSortSchema(nonNullableFieldBuilder.toSchema({})),
    );

    expect(nullableFieldSchema).toMatchInlineSnapshot(`
      "type Query {
        bothNull: [Boolean]
        bothNull2: [Boolean]
        explicitNullableList: [Boolean!]
        explicitNullableListError: [Boolean!]
        inputFields(bothNullable: [Boolean], nonNullable: Boolean!, nonNullableList: [Boolean!]!, nonNullableListItems: [Boolean!]!, nullable: Boolean, nullableList: [Boolean!], nullableListItems: [Boolean]!): Boolean!
        nonNullable: Boolean!
        nonNullableError: Boolean!
        nonNullableList: [Boolean!]!
        nonNullableListError: [Boolean!]!
        nullable: Boolean
        nullableList: [Boolean!]
        nullableListError: [Boolean!]
        nullableListItems: [Boolean]!
        nullableListItemsError: [Boolean]!
      }
      "
    `);
    expect(nonNullableFieldSchema).toMatchInlineSnapshot(`
      "type Query {
        bothNull: [Boolean]
        bothNull2: [Boolean]
        explicitNullableList: [Boolean!]
        explicitNullableListError: [Boolean!]
        inputFields(bothNullable: [Boolean], nonNullable: Boolean!, nonNullableList: [Boolean!]!, nonNullableListItems: [Boolean!]!, nullable: Boolean, nullableList: [Boolean!], nullableListItems: [Boolean]!): Boolean!
        nonNullable: Boolean!
        nonNullableError: Boolean!
        nonNullableList: [Boolean!]!
        nonNullableListError: [Boolean!]!
        nullable: Boolean
        nullableList: [Boolean!]
        nullableListError: [Boolean!]
        nullableListItems: [Boolean]!
        nullableListItemsError: [Boolean]!
      }
      "
    `);

    expect(nullableFieldSchema).toMatch(nonNullableFieldSchema);
  });
});
