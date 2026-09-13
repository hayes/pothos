import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import {
  buildSchema,
  execute,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  lexicographicSortSchema,
  printSchema,
  validateSchema,
} from 'graphql';
import { gql } from 'graphql-tag';
import AddGraphQLPlugin from '../src';

interface Types {
  Context: {};
  Scalars: {
    DateTime: {
      Input: string;
      Output: string;
    };
  };
}

const DateTime = new GraphQLScalarType({ name: 'DateTime' });

function objectType(
  name: string,
  fields: Record<string, string>,
  options: { description?: string; extensions?: Record<string, unknown> } = {},
) {
  return new GraphQLObjectType({
    name,
    ...options,
    fields: () =>
      Object.fromEntries(
        Object.entries(fields).map(([fieldName, value]) => [
          fieldName,
          { type: GraphQLString, resolve: () => value },
        ]),
      ),
  });
}

const lateFieldsPlugin = 'lateFieldsPlugin' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;
class LateFieldsPlugin extends BasePlugin<SchemaTypes> {
  override beforeBuild() {
    this.builder.queryField('hello', (t) => t.int({ resolve: () => 42 }));
  }
}
SchemaBuilder.registerPlugin(lateFieldsPlugin, LateFieldsPlugin as never);

it.each([
  false,
  true,
])('preserves overrides from beforeBuild hooks (import first: %s)', async (importFirst) => {
  const builder = new SchemaBuilder({
    plugins: importFirst
      ? [AddGraphQLPlugin, lateFieldsPlugin]
      : [lateFieldsPlugin, AddGraphQLPlugin],
    add: {
      schema: new GraphQLSchema({
        query: objectType('Query', { hello: 'imported', keep: 'kept' }),
      }),
    },
  });
  builder.queryType({});
  const schema = builder.toSchema();
  expect(validateSchema(schema)).toEqual([]);
  expect(await execute({ schema, document: gql`{ hello keep }` })).toEqual({
    data: { hello: 42, keep: 'kept' },
  });
});

it.each([
  false,
  true,
])('preserves inherited local fields (own override: %s)', async (ownOverride) => {
  const builder = new SchemaBuilder({
    plugins: [AddGraphQLPlugin],
    add: {
      schema: new GraphQLSchema({
        query: objectType('Existing', { hello: 'imported', keep: 'kept' }),
      }),
    },
  });
  const base = builder.interfaceRef<{}>('Base');
  builder.interfaceType(base, { fields: (t) => ({ hello: t.int({ resolve: () => 42 }) }) });
  const child = builder.interfaceRef<{}>('Child');
  builder.interfaceType(child, { interfaces: [base], fields: () => ({}) });
  const existing = builder.objectRef<{}>('Existing');
  builder.objectType(existing, {
    interfaces: [child, base],
    fields: ownOverride ? (t) => ({ hello: t.int({ resolve: () => 43 }) }) : () => ({}),
  });
  builder.queryType({ fields: (t) => ({ obj: t.field({ type: existing, resolve: () => ({}) }) }) });
  for (let build = 0; build < 2; build += 1) {
    const schema = builder.toSchema();
    expect(validateSchema(schema)).toEqual([]);
    expect(await execute({ schema, document: gql`{ obj { hello keep } }` })).toEqual({
      data: { obj: { hello: ownOverride ? 43 : 42, keep: 'kept' } },
    });
  }
});

it.each([
  false,
  true,
])('preserves interfaces implemented by beforeBuild hooks (import first: %s)', async (importFirst) => {
  const pluginName = `lateInterface${importFirst}` as keyof PothosSchemaTypes.Plugins<SchemaTypes>;
  const builder = new SchemaBuilder({
    plugins: importFirst ? [AddGraphQLPlugin, pluginName] : [pluginName, AddGraphQLPlugin],
    add: {
      schema: new GraphQLSchema({
        query: objectType('Existing', { hello: 'imported', keep: 'kept' }),
      }),
    },
  });
  const base = builder.interfaceRef<{}>('Base');
  const child = builder.interfaceRef<{}>('Child');
  class LateInterfacePlugin extends BasePlugin<SchemaTypes> {
    override beforeBuild() {
      builder.interfaceType(base, { fields: (t) => ({ hello: t.int({ resolve: () => 42 }) }) });
      builder.interfaceType(child, { interfaces: [base], fields: () => ({}) });
    }
  }
  SchemaBuilder.registerPlugin(pluginName, LateInterfacePlugin as never);
  const existing = builder.objectRef<{}>('Existing');
  builder.objectType(existing, { interfaces: [child, base], fields: () => ({}) });
  builder.queryType({ fields: (t) => ({ obj: t.field({ type: existing, resolve: () => ({}) }) }) });
  const schema = builder.toSchema();
  expect(validateSchema(schema)).toEqual([]);
  expect(await execute({ schema, document: gql`{ obj { hello keep } }` })).toEqual({
    data: { obj: { hello: 42, keep: 'kept' } },
  });
});

it('allows local overrides to be added after a schema build', async () => {
  const builder = new SchemaBuilder({
    plugins: [AddGraphQLPlugin],
    add: {
      schema: new GraphQLSchema({
        query: objectType('Query', { hello: 'imported', keep: 'kept' }),
      }),
    },
  });
  builder.queryType({});
  const first = builder.toSchema();
  expect(await execute({ schema: first, document: gql`{ hello keep }` })).toEqual({
    data: { hello: 'imported', keep: 'kept' },
  });
  builder.queryField('hello', (t) => t.int({ resolve: () => 42 }));
  const second = builder.toSchema();
  expect(await execute({ schema: second, document: gql`{ hello keep }` })).toEqual({
    data: { hello: 42, keep: 'kept' },
  });
  expect(await execute({ schema: first, document: gql`{ hello keep }` })).toEqual({
    data: { hello: 'imported', keep: 'kept' },
  });
});

const fieldKinds = new Map<string, string>();
const recordKindPlugin = 'recordKindPlugin' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

class RecordKindPlugin<T extends SchemaTypes> extends BasePlugin<T> {
  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<T>) {
    fieldKinds.set(`${fieldConfig.parentType}.${fieldConfig.name}`, fieldConfig.kind);

    return fieldConfig;
  }
}

SchemaBuilder.registerPlugin(recordKindPlugin, RecordKindPlugin as never);

function createBuilder(schema: GraphQLSchema) {
  return new SchemaBuilder<Types>({
    plugins: [AddGraphQLPlugin],
    add: { schema },
  });
}

function printSorted(schema: GraphQLSchema) {
  expect(validateSchema(schema)).toHaveLength(0);

  return printSchema(lexicographicSortSchema(schema));
}

function documentedQueryRoot() {
  return objectType(
    'Query',
    { hello: 'imported' },
    { description: 'imported query doc', extensions: { importedExt: true } },
  );
}

function buildDocumentedRootBothWays() {
  const withQueryType = createBuilder(new GraphQLSchema({ query: documentedQueryRoot() }));

  withQueryType.queryType({
    fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
  });

  const withQueryFields = createBuilder(new GraphQLSchema({ query: documentedQueryRoot() }));

  withQueryFields.queryFields((t) => ({ own: t.string({ resolve: () => 'own' }) }));

  return { fromQueryType: withQueryType.toSchema(), fromQueryFields: withQueryFields.toSchema() };
}

describe('imported schema roots', () => {
  it('adds a root with a name of its own as a regular object type', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Root', { hello: 'imported' }) }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        own: String
      }

      type Root {
        hello: String
      }"
    `);
  });

  it('merges a colliding root into a query type defined with queryType', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
        own: String
      }"
    `);
  });

  it('merges a colliding root into a query type defined with queryFields', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    builder.queryFields((t) => ({ own: t.string({ resolve: () => 'own' }) }));

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
        own: String
      }"
    `);
  });

  it('merges the same root fields for queryType and queryFields', () => {
    const { fromQueryType, fromQueryFields } = buildDocumentedRootBothWays();

    expect(Object.keys(fromQueryType.getQueryType()!.getFields())).toEqual(
      Object.keys(fromQueryFields.getQueryType()!.getFields()),
    );
    expect(printSorted(fromQueryType)).toMatchInlineSnapshot(`
      "type Query {
        hello: String
        own: String
      }"
    `);
    expect(printSorted(fromQueryFields)).toMatchInlineSnapshot(`
      """"imported query doc"""
      type Query {
        hello: String
        own: String
      }"
    `);
  });

  it('leaves the type options of a merged root to the configured type', () => {
    const { fromQueryType, fromQueryFields } = buildDocumentedRootBothWays();

    expect(fromQueryType.getQueryType()!.description).toBeUndefined();
    expect(fromQueryType.getQueryType()!.extensions).not.toHaveProperty('importedExt');

    expect(fromQueryFields.getQueryType()!.description).toBe('imported query doc');
    expect(fromQueryFields.getQueryType()!.extensions).toHaveProperty('importedExt', true);
  });

  it('resolves fields merged from a colliding root', async () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: objectType('Query', { hello: 'imported' }),
        mutation: objectType('Mutation', { doIt: 'imported mutation' }),
      }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    builder.mutationType({
      fields: (t) => ({ ownMutation: t.string({ resolve: () => 'own mutation' }) }),
    });

    const schema = builder.toSchema();

    expect(printSorted(schema)).toMatchInlineSnapshot(`
      "type Mutation {
        doIt: String
        ownMutation: String
      }

      type Query {
        hello: String
        own: String
      }"
    `);

    const result = await execute({
      schema,
      document: gql`
        query {
          hello
          own
        }
      `,
      contextValue: {},
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "hello": "imported",
          "own": "own",
        },
      }
    `);
  });

  it('merges root fields with arguments and referenced types', async () => {
    const builder = createBuilder(
      buildSchema(`
        type Query {
          thing(name: String!): Thing
        }

        type Thing {
          name: String
        }
      `),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    const schema = builder.toSchema();

    expect(printSorted(schema)).toMatchInlineSnapshot(`
      "type Query {
        own: String
        thing(name: String!): Thing
      }

      type Thing {
        name: String
      }"
    `);

    const result = await execute({
      schema,
      document: gql`
        query {
          thing(name: "thing") {
            name
          }
        }
      `,
      contextValue: {},
      rootValue: { thing: (args: { name: string }) => ({ name: args.name }) },
    });

    expect(result).toMatchInlineSnapshot(`
      {
        "data": {
          "thing": {
            "name": "thing",
          },
        },
      }
    `);
  });

  it.each([
    'query',
    'custom',
    'object',
  ] as const)('keeps configured %s fields over imported defaults in either registration order', async (kind) => {
    for (const localFirst of [false, true]) {
      const name = kind === 'query' ? 'Query' : 'Existing';
      const imported = new GraphQLSchema({
        query: objectType(name, { hello: 'imported', keep: 'kept' }),
      });
      const builder = new SchemaBuilder<Types>({ plugins: [AddGraphQLPlugin], add: {} });
      if (!localFirst) {
        builder.options.add = { schema: imported };
      }
      if (kind === 'object') {
        const object = builder
          .objectRef<{}>(name)
          .implement({ fields: (t) => ({ hello: t.int({ resolve: () => 42 }) }) });
        builder.queryType({
          fields: (t) => ({ obj: t.field({ type: object, resolve: () => ({}) }) }),
        });
      } else {
        builder.queryType({ name, fields: (t) => ({ hello: t.int({ resolve: () => 42 }) }) });
      }
      if (localFirst) {
        builder.options.add = { schema: imported };
      }
      for (let build = 0; build < 2; build += 1) {
        const schema = builder.toSchema();
        expect(validateSchema(schema)).toEqual([]);
        const result = await execute({
          schema,
          document: gql(kind === 'object' ? '{ obj { hello keep } }' : '{ hello keep }'),
        });
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual(
          kind === 'object' ? { obj: { hello: 42, keep: 'kept' } } : { hello: 42, keep: 'kept' },
        );
      }
    }
  });

  it('continues rejecting duplicate fields registered through queryFields or local declarations', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );
    builder.queryFields((t) => ({ hello: t.string({ resolve: () => 'local' }) }));
    expect(() => builder.toSchema()).toThrow('Duplicate field hello on Query');

    const local = new SchemaBuilder<Types>({ plugins: [AddGraphQLPlugin] });
    local.queryType({ fields: (t) => ({ hello: t.string({ resolve: () => 'one' }) }) });
    local.queryFields((t) => ({ hello: t.string({ resolve: () => 'two' }) }));
    expect(() => local.toSchema()).toThrow('Duplicate field hello on Query');
  });

  it('preserves explicit root overrides and removals when the same schema is imported', async () => {
    const imported = new GraphQLSchema({
      query: objectType('Query', { hello: 'imported', remove: 'removed', keep: 'kept' }),
    });
    const builder = createBuilder(imported);
    builder.addGraphQLObject(imported.getQueryType()!, {
      fields: (t) => ({ hello: t.int({ resolve: () => 42 }), remove: null }),
    });
    for (let build = 0; build < 2; build += 1) {
      const schema = builder.toSchema();
      expect(schema.getQueryType()!.getFields().remove).toBeUndefined();
      const result = await execute({ schema, document: gql`{ hello keep }` });
      expect(result).toEqual({ data: { hello: 42, keep: 'kept' } });
    }
  });

  it('adds roots that do not collide with configured types', () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: objectType('R', { hello: 'imported' }),
        mutation: objectType('M', { doIt: 'imported mutation' }),
      }),
    );

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "schema {
        query: Query
        mutation: M
      }

      type M {
        doIt: String
      }

      type Query {
        own: String
      }

      type R {
        hello: String
      }"
    `);
  });

  it('does not merge fields for types that are not roots of the imported schema', () => {
    const Thing = objectType('Thing', { a: 'imported a', b: 'imported b' });
    const builder = createBuilder(
      new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'ImportedQuery',
          fields: () => ({ thing: { type: Thing, resolve: () => ({}) } }),
        }),
      }),
    );

    builder.objectRef<{}>('Thing').implement({
      fields: (t) => ({ a: t.string({ resolve: () => 'own a' }) }),
    });

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type ImportedQuery {
        thing: Thing
      }

      type Query {
        own: String
      }

      type Thing {
        a: String
      }"
    `);
  });

  it('skips imported scalars that are already configured', () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: new GraphQLObjectType({
          name: 'ImportedQuery',
          fields: () => ({ when: { type: DateTime, resolve: () => '2020-01-01' } }),
        }),
      }),
    );

    builder.addScalarType('DateTime', DateTime);

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "scalar DateTime

      type ImportedQuery {
        when: DateTime
      }

      type Query {
        own: String
      }"
    `);
  });
  it('builds the same schema on repeated toSchema calls', () => {
    const merged = createBuilder(
      new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }),
    );

    merged.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    const promoted = createBuilder(
      new GraphQLSchema({
        query: objectType('Query', { hello: 'imported' }),
        mutation: objectType('Mutation', { doIt: 'imported' }),
      }),
    );

    for (const builder of [merged, promoted]) {
      const first = printSorted(builder.toSchema());

      expect(printSorted(builder.toSchema())).toBe(first);
    }
  });
  it('imports a root supplied through add.types only once', () => {
    const schema = new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) });
    const builder = new SchemaBuilder<Types>({
      plugins: [AddGraphQLPlugin],
      add: { schema, types: [schema.getQueryType()!] },
    });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
      }"
    `);
  });

  it('imports a root the builder already added directly only once', () => {
    const schema = new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) });
    const builder = createBuilder(schema);

    builder.addGraphQLObject(schema.getQueryType()!, {});

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "type Query {
        hello: String
      }"
    `);
  });
  it('still imports a root the builder added under a different name', () => {
    const schema = new GraphQLSchema({ query: objectType('Root', { hello: 'imported' }) });
    const builder = createBuilder(schema);

    builder.addGraphQLObject(schema.getQueryType()!, { name: 'Copy', rootKind: null });

    expect(printSorted(builder.toSchema())).toMatchInlineSnapshot(`
      "schema {
        query: Root
      }

      type Copy {
        hello: String
      }

      type Root {
        hello: String
      }"
    `);
  });
  it('registers merged root fields with the destination root kind', () => {
    const builder = new SchemaBuilder<Types>({
      plugins: [recordKindPlugin, AddGraphQLPlugin],
      add: { schema: new GraphQLSchema({ query: objectType('Query', { hello: 'imported' }) }) },
    });

    builder.queryType({
      fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }),
    });

    builder.toSchema();

    expect(fieldKinds.get('Query.own')).toBe('Query');
    expect(fieldKinds.get('Query.hello')).toBe('Query');
  });

  it('rejects imported mutations that collide with the configured query root', () => {
    const builder = createBuilder(
      new GraphQLSchema({
        query: objectType('Root', { hello: 'imported' }),
        mutation: objectType('Query', { mutate: 'mutation result' }),
      }),
    );
    builder.queryType({ fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }) });

    for (let attempt = 0; attempt < 2; attempt += 1) {
      expect(() => builder.toSchema()).toThrow(
        'Can not merge the imported Mutation root Query into the Query root with the same name',
      );
    }
  });

  it('reports an imported root that collides with a type that is not an object', () => {
    const builder = createBuilder(
      new GraphQLSchema({ query: objectType('Status', { hello: 'imported' }) }),
    );

    builder.enumType('Status', { values: ['Active'] as const });
    builder.queryType({ fields: (t) => ({ own: t.string({ resolve: () => 'own' }) }) });

    expect(() => builder.toSchema()).toThrowErrorMatchingInlineSnapshot(
      '[PothosSchemaError: Can not merge the imported root Status into the Enum type with the same name]',
    );
    expect(() => builder.toSchema()).toThrow(
      'Can not merge the imported root Status into the Enum type with the same name',
    );
  });
});
