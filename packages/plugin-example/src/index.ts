import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosEnumValueConfig,
  type PothosInputFieldConfig,
  type PothosInterfaceTypeConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type PothosUnionTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';

export * from './types';

const pluginName = 'example';

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
    // biome-ignore lint/correctness/noUnusedVariables: <explanation>
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info);
    };
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    // biome-ignore lint/correctness/noUnusedVariables: <explanation>
    fieldConfig: PothosOutputFieldConfig<Types>,
  ) {
    return subscribe;
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    // biome-ignore lint/correctness/noUnusedVariables: <explanation>
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosExamplePlugin);
