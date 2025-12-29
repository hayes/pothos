import './global-types';
import './schema-builder';
import { addTypes } from '@graphql-tools/utils';
import SchemaBuilder, { BasePlugin, type SchemaTypes } from '@pothos/core';
import { GraphQLSchema } from 'graphql';
import { addTypeToSchema } from './utils';

const pluginName = 'addGraphQL';

export default pluginName;

const builtInTypes = Object.keys(new GraphQLSchema({}).getTypeMap());
export class PothosAddGraphQLPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override beforeBuild(): void {
    const { schema, types } = this.builder.options.add ?? {};

    const allTypes = [
      ...(Array.isArray(types) ? types : Object.values(types ?? {})),
      ...Object.values(schema?.getTypeMap() ?? {}).filter(
        (type) => !builtInTypes.includes(type.name),
      ),
    ];

    for (const type of allTypes) {
      addTypeToSchema(this.builder, type);
    }
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { schema: addedSchema, includeSchemaDirectives = false } = this.builder.options.add ?? {};

    if (includeSchemaDirectives && addedSchema) {
      return addTypes(schema, [...addedSchema.getDirectives()]);
    }

    return schema;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
