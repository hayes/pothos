import { lexicographicSortSchema, printSchema } from 'graphql';
import {
  nonNullableFieldBuilder,
  nullableFieldBuilder,
} from './examples/default-field-nullability';
import exampleSchema from './examples/random-stuff';

describe('Example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});

describe('Field Nullability', () => {
  it('generates expected schema', () => {
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
      }"
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
      }"
    `);

    expect(nullableFieldSchema).toMatch(nonNullableFieldSchema);
  });
});
