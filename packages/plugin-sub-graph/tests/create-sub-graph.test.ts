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
  });
});
