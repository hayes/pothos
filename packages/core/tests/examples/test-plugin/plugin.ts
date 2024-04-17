import './global-types';
import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosEnumValueConfig,
  PothosInputFieldConfig,
  PothosInterfaceTypeConfig,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  PothosUnionTypeConfig,
  SchemaTypes,
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
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => resolver(parent, args, context, info);
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ) {
    return subscribe;
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosTestPlugin);
