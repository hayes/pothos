/* eslint-disable no-console */
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
} from '@pothos/core';

export * from './types';

const pluginName = 'example' as const;

export default pluginName;

export class PothosExamplePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    console.log(this.builder.options.nestedOptionsObject?.exampleOption);
    console.log(this.options.customBuildTimeOptions);

    if (typeConfig.kind === 'Object') {
      console.log(typeConfig.pothosOptions.optionOnObject);
    }

    return typeConfig;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'Mutation') {
      console.log(fieldConfig.pothosOptions.customMutationFieldOption);
    }

    return fieldConfig;
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    return fieldConfig;
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
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
    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info);
    };
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

SchemaBuilder.registerPlugin(pluginName, PothosExamplePlugin);
