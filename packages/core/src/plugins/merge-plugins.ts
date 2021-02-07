/* eslint-disable lines-between-class-members */
import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import {
  SchemaTypes,
  GiraphQLTypeConfig,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
  PluginMap,
  PluginName,
  BuildCache,
} from '..';
import {
  GiraphQLEnumValueConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
} from '../types';
import { BasePlugin } from './plugin';

export class MergedPlugins<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypePlugins;
  onInputFieldPlugins;
  onOutputFieldPlugins;
  onEnumValuePlugins;
  wrapOutputFieldPlugins;
  beforeBuildPlugins;
  afterBuildPlugins;
  wrapResolvePlugins;
  wrapSubscribePlugins;
  wrapResolveTypePlugins;

  constructor(buildCache: BuildCache<Types>, pluginMap: PluginMap<Types>) {
    super(buildCache, 'GiraphQLMergedPlugin' as never);

    const plugins: BasePlugin<Types>[] = [];

    Object.keys(pluginMap).forEach((pluginName) =>
      plugins.push(pluginMap[pluginName as PluginName]),
    );

    this.onTypePlugins = plugins.filter((plugin) => plugin.onTypeConfig) as Pick<
      Required<BasePlugin<Types>>,
      'onTypeConfig'
    >[];

    this.onInputFieldPlugins = plugins.filter((plugin) => plugin.onInputFieldConfig) as Pick<
      Required<BasePlugin<Types>>,
      'onInputFieldConfig'
    >[];

    this.onOutputFieldPlugins = plugins.filter((plugin) => plugin.onOutputFieldConfig) as Pick<
      Required<BasePlugin<Types>>,
      'onOutputFieldConfig'
    >[];

    this.wrapOutputFieldPlugins = plugins.filter((plugin) => plugin.usesFieldWrapper()) as Pick<
      Required<BasePlugin<Types>>,
      'wrapOutputField'
    >[];

    this.onEnumValuePlugins = plugins.filter((plugin) => plugin.onEnumValueConfig) as Pick<
      Required<BasePlugin<Types>>,
      'onEnumValueConfig'
    >[];

    this.beforeBuildPlugins = plugins.filter((plugin) => plugin.beforeBuild) as Pick<
      Required<BasePlugin<Types>>,
      'beforeBuild'
    >[];

    this.afterBuildPlugins = plugins.filter((plugin) => plugin.afterBuild) as Pick<
      Required<BasePlugin<Types>>,
      'afterBuild'
    >[];

    this.wrapResolvePlugins = plugins.filter((plugin) => plugin.wrapResolve) as Pick<
      Required<BasePlugin<Types>>,
      'wrapResolve'
    >[];

    this.wrapSubscribePlugins = plugins.filter((plugin) => plugin.wrapSubscribe) as Pick<
      Required<BasePlugin<Types>>,
      'wrapSubscribe'
    >[];

    this.wrapResolveTypePlugins = plugins.filter((plugin) => plugin.wrapResolveType) as Pick<
      Required<BasePlugin<Types>>,
      'wrapResolveType'
    >[];
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    for (const plugin of this.onTypePlugins) {
      plugin.onTypeConfig(typeConfig);
    }
  }

  wrapOutputField(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    const all = [];

    for (const plugin of this.wrapOutputFieldPlugins) {
      const wrappers = plugin.wrapOutputField(fieldConfig, buildOptions);

      if (Array.isArray(wrappers)) {
        all.push(...wrappers);
      } else if (wrappers) {
        all.push(wrappers);
      }
    }

    return all;
  }

  usesFieldWrapper() {
    return this.wrapOutputFieldPlugins.length > 0;
  }

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    for (const plugin of this.onInputFieldPlugins) {
      plugin.onInputFieldConfig(fieldConfig);
    }
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    for (const plugin of this.onOutputFieldPlugins) {
      plugin.onOutputFieldConfig(fieldConfig);
    }
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
    for (const plugin of this.onEnumValuePlugins) {
      plugin.onEnumValueConfig(valueConfig);
    }
  }

  beforeBuild(options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {
    for (const plugin of this.beforeBuildPlugins) {
      plugin.beforeBuild(options);
    }
  }

  afterBuild(schema: GraphQLSchema, options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {
    for (const plugin of this.afterBuildPlugins) {
      plugin.afterBuild(schema, options);
    }
  }

  wrapResolve(
    resolve: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    let wrapped = resolve;

    for (let i = this.wrapResolvePlugins.length - 1; i >= 0; i -= 1) {
      wrapped = this.wrapResolvePlugins[i].wrapResolve(wrapped, fieldConfig, buildOptions);
    }

    return wrapped;
  }

  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    let wrapped = subscribe;

    for (let i = this.wrapSubscribePlugins.length - 1; i >= 0; i -= 1) {
      wrapped = this.wrapSubscribePlugins[i].wrapSubscribe(wrapped, fieldConfig, buildOptions);
    }

    return wrapped;
  }

  wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    let wrapped = resolveType;

    for (let i = this.wrapResolveTypePlugins.length - 1; i >= 0; i -= 1) {
      wrapped = this.wrapResolveTypePlugins[i].wrapResolveType(wrapped, typeConfig, buildOptions);
    }

    return wrapped;
  }
}
