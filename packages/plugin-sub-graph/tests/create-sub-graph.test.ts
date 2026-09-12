import SchemaBuilder from '@pothos/core';
import {
  DirectiveLocation,
  GraphQLDirective,
  type GraphQLInputObjectType,
  GraphQLSchema,
} from 'graphql';
import SubGraphPlugin, { PothosSubGraphPlugin } from '../src';

interface Types {
  SubGraphs: 'Private' | 'Public';
}

function createBuilder() {
  return new SchemaBuilder<Types>({
    plugins: [SubGraphPlugin],
    subGraphs: {
      defaultForTypes: ['Public'],
      fieldsInheritFromTypes: true,
    },
  });
}

describe('createSubGraph', () => {
  it('remaps custom directive argument types to the rebuilt types', () => {
    const builder = createBuilder();
    const Filter = builder.inputType('Filter', {
      fields: (t) => ({ term: t.string() }),
    });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          args: { filter: t.arg({ type: Filter }) },
          resolve: () => 'hello',
        }),
      }),
    });

    const fullSchema = builder.toSchema();
    const directive = new GraphQLDirective({
      name: 'filter',
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: { input: { type: fullSchema.getType('Filter') as GraphQLInputObjectType } },
    });
    const schemaWithDirective = new GraphQLSchema({
      ...fullSchema.toConfig(),
      directives: [...fullSchema.getDirectives(), directive],
    });

    const subGraph = PothosSubGraphPlugin.createSubGraph(schemaWithDirective, 'Public', builder);

    const directiveArgType = subGraph
      .getDirective('filter')
      ?.args.find((arg) => arg.name === 'input')?.type;

    expect(directiveArgType).toBe(subGraph.getType('Filter'));
    expect(subGraph.getDirective('skip')).toBe(schemaWithDirective.getDirective('skip'));
  });

  it('throws when a directive argument type is excluded from the sub-graph', () => {
    const builder = createBuilder();
    const Filter = builder.inputType('Filter', {
      fields: (t) => ({ term: t.string() }),
    });
    builder.inputType('Secret', {
      subGraphs: ['Private'],
      fields: (t) => ({ key: t.string() }),
    });

    builder.queryType({
      fields: (t) => ({
        hello: t.string({
          args: { filter: t.arg({ type: Filter }) },
          resolve: () => 'hello',
        }),
      }),
    });

    const fullSchema = builder.toSchema();
    const directive = new GraphQLDirective({
      name: 'mixed',
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: {
        input: { type: fullSchema.getType('Filter') as GraphQLInputObjectType },
        secret: { type: fullSchema.getType('Secret') as GraphQLInputObjectType },
      },
    });
    const schemaWithDirective = new GraphQLSchema({
      ...fullSchema.toConfig(),
      directives: [...fullSchema.getDirectives(), directive],
    });

    expect(() =>
      PothosSubGraphPlugin.createSubGraph(schemaWithDirective, 'Public', builder),
    ).toThrow(
      'Secret (referenced by secret argument of @mixed) does not exist in subGraph (Public)',
    );
  });

  it('throws when every argument of a directive is excluded from the sub-graph', () => {
    const builder = createBuilder();
    builder.inputType('Secret', {
      subGraphs: ['Private'],
      fields: (t) => ({ key: t.string() }),
    });

    builder.queryType({
      fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }),
    });

    const fullSchema = builder.toSchema();
    const directive = new GraphQLDirective({
      name: 'secretOnly',
      locations: [DirectiveLocation.FIELD_DEFINITION],
      args: { secret: { type: fullSchema.getType('Secret') as GraphQLInputObjectType } },
    });
    const schemaWithDirective = new GraphQLSchema({
      ...fullSchema.toConfig(),
      directives: [...fullSchema.getDirectives(), directive],
    });

    expect(() =>
      PothosSubGraphPlugin.createSubGraph(schemaWithDirective, 'Public', builder),
    ).toThrow(
      'Secret (referenced by secret argument of @secretOnly) does not exist in subGraph (Public)',
    );
  });

  it('preserves the schema description', () => {
    const builder = createBuilder();

    builder.queryType({
      fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }),
    });

    const fullSchema = builder.toSchema();
    const describedSchema = new GraphQLSchema({
      ...fullSchema.toConfig(),
      description: 'Public API',
    });

    const subGraph = PothosSubGraphPlugin.createSubGraph(describedSchema, 'Public', builder);

    expect(subGraph.description).toBe('Public API');
  });
});
