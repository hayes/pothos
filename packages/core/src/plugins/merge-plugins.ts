import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import {
  BuildCache,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  SchemaTypes,
} from '../index.js';
import {
  GiraphQLEnumValueConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
} from '../types/index.js';
import { BasePlugin } from './plugin.js';

export class MergedPlugins<Types extends SchemaTypes> extends BasePlugin<Types> {
  plugins;

  constructor(buildCache: BuildCache<Types>, plugins: BasePlugin<Types>[]) {
    super(buildCache, 'GiraphQLMergedPlugin' as never);

    this.plugins = plugins;
  }

  override onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    return this.plugins.reduceRight(
      (config, plugin) => (config === null ? config : plugin.onTypeConfig(config)),
      typeConfig,
    );
  }

  override onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    return this.plugins.reduceRight<GiraphQLInputFieldConfig<Types> | null>(
      (config, plugin) => (config === null ? config : plugin.onInputFieldConfig(config)),
      fieldConfig,
    );
  }

  override onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    return this.plugins.reduceRight<GiraphQLOutputFieldConfig<Types> | null>(
      (config, plugin) => (config === null ? config : plugin.onOutputFieldConfig(config)),
      fieldConfig,
    );
  }

  override onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
    return this.plugins.reduceRight<GiraphQLEnumValueConfig<Types> | null>(
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
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ) {
    return this.plugins.reduceRight(
      (nextResolve, plugin) => plugin.wrapResolve(nextResolve, fieldConfig),
      resolve,
    );
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ) {
    return this.plugins.reduceRight(
      (nextSubscribe, plugin) => plugin.wrapSubscribe(nextSubscribe, fieldConfig),
      subscribe,
    );
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
  ) {
    return this.plugins.reduceRight(
      (nextResolveType, plugin) => plugin.wrapResolveType(nextResolveType, typeConfig),
      resolveType,
    );
  }
}
