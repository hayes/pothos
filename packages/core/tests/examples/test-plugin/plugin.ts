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
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    return typeConfig;
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    if (fieldConfig.name === 'removeMe') {
      return null;
    }

    return fieldConfig;
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
    if (valueConfig.value === 'removeMe') {
      return null;
    }

    return valueConfig;
  }

  beforeBuild() {}

  afterBuild(schema: GraphQLSchema): GraphQLSchema {
    return schema;
  }

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => resolver(parent, args, context, info) as unknown;
  }

  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ) {
    return subscribe;
  }

  wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, GiraphQLTestPlugin);
