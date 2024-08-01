import './global-types';
import type { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  type PothosEnumValueConfig,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
} from '../../../src';

const pluginName = 'test';

export default pluginName;

export class PothosTestPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    if (valueConfig.value === 'removeMe') {
      return null;
    }

    return valueConfig;
  }

  override beforeBuild() {}

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    return schema;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    _fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => resolver(parent, args, context, info);
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    _fieldConfig: PothosOutputFieldConfig<Types>,
  ) {
    return subscribe;
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    _typeConfig: PothosTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosTestPlugin);
