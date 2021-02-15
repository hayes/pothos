/* eslint-disable no-console */
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
} from '@giraphql/core';

export * from './types';

const pluginName = 'example' as const;

export default pluginName;

export class GiraphQLExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    console.log(this.builder.options.nestedOptionsObject?.exampleOption);
    console.log(this.options.customBuildTimeOptions);

    if (typeConfig.kind === 'Object') {
      console.log(typeConfig.giraphqlOptions.optionOnObject);
    }

    return typeConfig;
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'Mutation') {
      console.log(fieldConfig.giraphqlOptions.customMutationFieldOption);
    }

    return fieldConfig;
  }

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    return fieldConfig;
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
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
    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info);
    };
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

SchemaBuilder.registerPlugin(pluginName, GiraphQLExamplePlugin);
