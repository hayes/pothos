import type {
  GraphQLFieldResolver,
  GraphQLIsTypeOfFn,
  GraphQLSchema,
  GraphQLTypeResolver,
} from 'graphql';
import type { BuildCache } from '../build-cache';
import type {
  PothosEnumValueConfig,
  PothosInputFieldConfig,
  PothosInterfaceTypeConfig,
  PothosObjectTypeConfig,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  PothosUnionTypeConfig,
  SchemaTypes,
} from '../types';
import { completeValue, reduceMaybeAsync } from '../utils';
import { BasePlugin } from './plugin';

export class MergedPlugins<Types extends SchemaTypes> extends BasePlugin<Types> {
  plugins;

  constructor(buildCache: BuildCache<Types>, plugins: BasePlugin<Types>[]) {
    super(buildCache, 'PothosMergedPlugin' as never);

    this.plugins = plugins;
  }

  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return this.plugins.reduceRight(
      (config, plugin) => (config === null ? config : plugin.onTypeConfig(config)),
      typeConfig,
    );
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    return this.plugins.reduceRight<PothosInputFieldConfig<Types> | null>(
      (config, plugin) => (config === null ? config : plugin.onInputFieldConfig(config)),
      fieldConfig,
    );
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    return this.plugins.reduceRight<PothosOutputFieldConfig<Types> | null>(
      (config, plugin) => (config === null ? config : plugin.onOutputFieldConfig(config)),
      fieldConfig,
    );
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    return this.plugins.reduceRight<PothosEnumValueConfig<Types> | null>(
      (config, plugin) => (config === null ? config : plugin.onEnumValueConfig(config)),
      valueConfig,
    );
  }

  override beforeBuild() {
    for (const plugin of this.plugins) {
      plugin.beforeBuild();
    }
  }

  override afterBuild(schema: GraphQLSchema) {
    return this.plugins.reduceRight((nextSchema, plugin) => plugin.afterBuild(nextSchema), schema);
  }

  override wrapResolve(
    resolve: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const wrapped = this.plugins.reduceRight(
      (nextResolve, plugin) => plugin.wrapResolve(nextResolve, fieldConfig),
      resolve,
    );

    if (!fieldConfig.argMappers.length) {
      return this.wrapArgMappers(wrapped, fieldConfig)!;
    }
    const argMappers = fieldConfig.argMappers;

    return this.wrapArgMappers((parent, args, context, info) => {
      const mappedArgs = reduceMaybeAsync(argMappers, args, (acc, argMapper) => {
        return argMapper(acc as Record<string, unknown>, context, info);
      });

      return completeValue(mappedArgs, (mappedArgs) => wrapped(parent, mappedArgs, context, info));
    }, fieldConfig)!;
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const wrapped = this.plugins.reduceRight(
      (nextSubscribe, plugin) => plugin.wrapSubscribe(nextSubscribe, fieldConfig),
      subscribe,
    );

    if (!wrapped || !fieldConfig.argMappers.length) {
      return this.wrapArgMappers(wrapped, fieldConfig);
    }

    const argMappers = fieldConfig.argMappers;
    return this.wrapArgMappers((parent, args, context, info) => {
      const mappedArgs = reduceMaybeAsync(argMappers, args, (acc, argMapper) => {
        return argMapper(acc as Record<string, unknown>, context, info);
      });

      return completeValue(mappedArgs, (mappedArgs) => wrapped(parent, mappedArgs, context, info));
    }, fieldConfig);
  }

  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    return this.plugins.reduceRight(
      (nextResolveType, plugin) => plugin.wrapArgMappers(nextResolveType, fieldConfig),
      resolver,
    );
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ) {
    return this.plugins.reduceRight(
      (nextResolveType, plugin) => plugin.wrapResolveType(nextResolveType, typeConfig),
      resolveType,
    );
  }

  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ) {
    return this.plugins.reduceRight(
      (nextResolveType, plugin) => plugin.wrapIsTypeOf(nextResolveType, typeConfig),
      isTypeOf,
    );
  }
}
