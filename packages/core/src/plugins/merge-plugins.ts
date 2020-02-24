import { BasePlugin, Field } from '..';
import {
  TypeParam,
  BuildCacheEntryWithFields,
  FieldMap,
  BuildCacheEntry,
  MaybePromise,
} from '../types';
import { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export function mergePlugins(plugins: BasePlugin[]): Required<BasePlugin> {
  const visitTypePlugins: Pick<Required<BasePlugin>, 'visitType'>[] = plugins.filter(
    plugin => plugin.visitType,
  ) as Pick<Required<BasePlugin>, 'visitType'>[];

  const updateFieldsPlugins: Pick<Required<BasePlugin>, 'updateFields'>[] = plugins.filter(
    plugin => plugin.updateFields,
  ) as Pick<Required<BasePlugin>, 'updateFields'>[];

  const updateFieldConfigPlugins: Pick<
    Required<BasePlugin>,
    'updateFieldConfig'
  >[] = plugins.filter(plugin => plugin.updateFieldConfig) as Pick<
    Required<BasePlugin>,
    'updateFieldConfig'
  >[];

  const onFieldWrapPlugins: Pick<Required<BasePlugin>, 'onFieldWrap'>[] = plugins.filter(
    plugin => plugin.onFieldWrap,
  ) as Pick<Required<BasePlugin>, 'onFieldWrap'>[];

  const beforeResolvePlugins: Pick<Required<BasePlugin>, 'beforeResolve'>[] = plugins.filter(
    plugin => plugin.beforeResolve,
  ) as Pick<Required<BasePlugin>, 'beforeResolve'>[];

  return {
    visitType(entry: BuildCacheEntry, cache: BuildCache) {
      for (const plugin of visitTypePlugins) {
        plugin.visitType(entry, cache);
      }
    },
    updateFields(entry: BuildCacheEntryWithFields, fields: FieldMap, cache: BuildCache) {
      return updateFieldsPlugins.reduce(
        (newFields, plugin) => plugin.updateFields(entry, newFields, cache),
        fields,
      );
    },

    updateFieldConfig(
      name: string,
      field: Field<{}, any, TypeParam<any>>,
      config: GraphQLFieldConfig<unknown, unknown>,
      cache: BuildCache,
    ) {
      return updateFieldConfigPlugins.reduce(
        (newConfig, plugin) => plugin.updateFieldConfig(name, field, newConfig, cache),
        config,
      );
    },

    onFieldWrap(
      name: string,
      field: Field<{}, any, TypeParam<any>>,
      config: GraphQLFieldConfig<unknown, unknown>,
      data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
      cache: BuildCache,
    ) {
      for (const plugin of onFieldWrapPlugins) {
        plugin.onFieldWrap(name, field, config, data, cache);
      }
    },

    async beforeResolve(
      parent: ResolveValueWrapper,
      data: GiraphQLSchemaTypes.FieldWrapData,
      args: object,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      const onResolveFns: ((value: unknown) => MaybePromise<void>)[] = [];
      const onWrapFns: ((child: ResolveValueWrapper) => MaybePromise<void>)[] = [];

      for (const plugin of beforeResolvePlugins) {
        const hooks = await plugin.beforeResolve(parent, data, args, context, info);

        if (hooks && hooks.onResolve) {
          onResolveFns.push(hooks.onResolve);
        }

        if (hooks && hooks.onWrap) {
          onWrapFns.push(hooks.onWrap);
        }
      }

      return {
        onResolve: onResolveFns.length
          ? async (value: unknown) => {
              for (const fn of onResolveFns) {
                await fn(value);
              }
            }
          : undefined,
        onWrap: onWrapFns.length
          ? async (child: ResolveValueWrapper) => {
              for (const fn of onWrapFns) {
                await fn(child);
              }
            }
          : undefined,
      };
    },
  };
}
