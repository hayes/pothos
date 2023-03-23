import './global-types';
import { GraphQLSchema } from 'graphql';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@pothos/core';
import { addTypeToSchema } from './schema-builder';

const pluginName = 'addGraphQL' as const;

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
}

SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
