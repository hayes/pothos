/* eslint-disable no-console */
import './global-types.js';
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
} from '@giraphql/core';

export * from './types.js';

const pluginName = 'example' as const;

export default pluginName;

export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    console.log(this.builder.options.nestedOptionsObject?.exampleOption);
    console.log(this.options.customBuildTimeOptions);

    if (typeConfig.kind === 'Object') {
      console.log(typeConfig.giraphqlOptions.optionOnObject);
    }

    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'Mutation') {
      console.log(fieldConfig.giraphqlOptions.customMutationFieldOption);
    }

    return fieldConfig;
  }

  override onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    return fieldConfig;
  }

  override onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
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
    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info) as unknown;
    };
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

SchemaBuilder.registerPlugin(pluginName, GiraphQLExamplePlugin);
