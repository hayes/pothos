import {
  BasePlugin,
  SchemaTypes,
  GiraphQLTypeConfig,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
  PluginMap,
  PluginName,
} from '..';
import { GiraphQLEnumValueConfig } from '../types';

export function mergePlugins<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  pluginMap: PluginMap<Types>,
): BasePlugin<Types> {
  const plugins: BasePlugin<Types>[] = [];

  Object.keys(pluginMap).forEach((pluginName) => plugins.push(pluginMap[pluginName as PluginName]));

  const onTypePlugins: Pick<Required<BasePlugin<Types>>, 'onTypeConfig'>[] = plugins.filter(
    (plugin) => plugin.onTypeConfig,
  ) as Pick<Required<BasePlugin<Types>>, 'onTypeConfig'>[];

  const onInputFieldPlugins = plugins.filter((plugin) => plugin.onInputFieldConfig) as Pick<
    Required<BasePlugin<Types>>,
    'onInputFieldConfig'
  >[];

  const onOutputFieldPlugins = plugins.filter((plugin) => plugin.onOutputFieldConfig) as Pick<
    Required<BasePlugin<Types>>,
    'onOutputFieldConfig'
  >[];

  const onEnumValuePlugins = plugins.filter((plugin) => plugin.onEnumValueConfig) as Pick<
    Required<BasePlugin<Types>>,
    'onEnumValueConfig'
  >[];

  const wrapOutputFieldPlugins = plugins.filter((plugin) => plugin.usesFieldWrapper()) as Pick<
    Required<BasePlugin<Types>>,
    'wrapOutputField'
  >[];

  const beforeBuildPlugins = plugins.filter((plugin) => plugin.beforeBuild) as Pick<
    Required<BasePlugin<Types>>,
    'beforeBuild'
  >[];

  const afterBuildPlugins = plugins.filter((plugin) => plugin.afterBuild) as Pick<
    Required<BasePlugin<Types>>,
    'afterBuild'
  >[];

  return {
    name: 'GiraphQLMergedPlugin' as never,
    builder,
    onTypeConfig(typeConfig: GiraphQLTypeConfig) {
      for (const plugin of onTypePlugins) {
        plugin.onTypeConfig(typeConfig);
      }
    },

    wrapOutputField(
      fieldConfig: GiraphQLOutputFieldConfig<Types>,
      buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
    ) {
      const all = [];

      for (const plugin of wrapOutputFieldPlugins) {
        const wrappers = plugin.wrapOutputField(fieldConfig, buildOptions);

        if (Array.isArray(wrappers)) {
          all.push(...wrappers);
        } else if (wrappers) {
          all.push(wrappers);
        }
      }

      return all;
    },

    usesFieldWrapper() {
      return wrapOutputFieldPlugins.length > 0;
    },

    onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
      for (const plugin of onInputFieldPlugins) {
        plugin.onInputFieldConfig(fieldConfig);
      }
    },

    onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
      for (const plugin of onOutputFieldPlugins) {
        plugin.onOutputFieldConfig(fieldConfig);
      }
    },

    onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
      for (const plugin of onEnumValuePlugins) {
        plugin.onEnumValueConfig(valueConfig);
      }
    },

    beforeBuild(options) {
      for (const plugin of beforeBuildPlugins) {
        plugin.beforeBuild(options);
      }
    },

    afterBuild(schema, options) {
      for (const plugin of afterBuildPlugins) {
        plugin.afterBuild(schema, options);
      }
    },
  };
}
