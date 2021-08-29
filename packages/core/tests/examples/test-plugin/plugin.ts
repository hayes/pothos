import './global-types';
import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLEnumValueConfig,
  GiraphQLInputFieldConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  GiraphQLUnionTypeConfig,
  SchemaTypes,
} from '../../../src';

const pluginName = 'test' as const;

export default pluginName;

export class GiraphQLTestPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  override onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  override onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
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
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => resolver(parent, args, context, info) as unknown;
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ) {
    return subscribe;
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLTestPlugin);
