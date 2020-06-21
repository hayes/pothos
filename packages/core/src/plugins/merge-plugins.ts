import { GraphQLSchema } from 'graphql';
import {
  BasePlugin,
  SchemaTypes,
  GiraphQLTypeConfig,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
} from '..';

export function mergePlugins<Types extends SchemaTypes>(
  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  plugins: BasePlugin<Types>[],
): Required<BasePlugin<Types>> {
  const onTypePlugins: Pick<Required<BasePlugin<Types>>, 'onTypeConfig'>[] = plugins.filter(
    (plugin) => plugin.onTypeConfig,
  ) as Pick<Required<BasePlugin<Types>>, 'onTypeConfig'>[];

  const onInputFieldPlugins: Pick<
    Required<BasePlugin<Types>>,
    'onInputFieldConfig'
  >[] = plugins.filter((plugin) => plugin.onInputFieldConfig) as Pick<
    Required<BasePlugin<Types>>,
    'onInputFieldConfig'
  >[];

  const onOutputFieldPlugins: Pick<
    Required<BasePlugin<Types>>,
    'onOutputFieldConfig'
  >[] = plugins.filter((plugin) => plugin.onOutputFieldConfig) as Pick<
    Required<BasePlugin<Types>>,
    'onOutputFieldConfig'
  >[];

  const wrapOutputFieldPlugins: Pick<
    Required<BasePlugin<Types>>,
    'wrapOutputField'
  >[] = plugins.filter((plugin) => plugin.wrapOutputField) as Pick<
    Required<BasePlugin<Types>>,
    'wrapOutputField'
  >[];

  const beforeBuildPlugins: Pick<Required<BasePlugin<Types>>, 'beforeBuild'>[] = plugins.filter(
    (plugin) => plugin.beforeBuild,
  ) as Pick<Required<BasePlugin<Types>>, 'beforeBuild'>[];

  const afterBuildPlugins: Pick<Required<BasePlugin<Types>>, 'afterBuild'>[] = plugins.filter(
    (plugin) => plugin.afterBuild,
  ) as Pick<Required<BasePlugin<Types>>, 'afterBuild'>[];

  return {
    builder,
    onTypeConfig(typeConfig: GiraphQLTypeConfig) {
      for (const plugin of onTypePlugins) {
        plugin.onTypeConfig(typeConfig);
      }
    },

    wrapOutputField(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
      const all = [];

      for (const plugin of wrapOutputFieldPlugins) {
        const wrappers = plugin.wrapOutputField(fieldConfig);

        if (Array.isArray(wrappers)) {
          all.push(...wrappers);
        } else if (wrappers) {
          all.push(wrappers);
        }
      }

      return all;
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

    beforeBuild() {
      for (const plugin of beforeBuildPlugins) {
        plugin.beforeBuild();
      }
    },

    afterBuild(schema: GraphQLSchema) {
      for (const plugin of afterBuildPlugins) {
        plugin.afterBuild(schema);
      }
    },
  };
}
