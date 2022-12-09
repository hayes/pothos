import './global-types';
import { GraphQLObjectType } from 'graphql';
import SchemaBuilder, { BasePlugin, SchemaTypes } from '@pothos/core';
import { AddGraphQLObjectTypeOptions } from './types';

const pluginName = 'simpleObjects' as const;

export default pluginName;

export class PothosSimpleObjectsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, PothosSimpleObjectsPlugin);

const proto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

proto.addGraphQLObject = function addGraphQLObject<Shape>(
  type: GraphQLObjectType<Shape>,
  options: AddGraphQLObjectTypeOptions<SchemaTypes, Shape>,
) {
  const ref = this.objectRef<Shape>(options?.name ?? type.name);

  return ref;
};
