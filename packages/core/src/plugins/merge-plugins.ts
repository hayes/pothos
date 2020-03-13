/* eslint-disable no-await-in-loop */
import { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';
import { BasePlugin, Field } from '..';
import { TypeParam, BuildCacheEntry, MaybePromise, ImplementedType } from '../types';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export function mergePlugins(plugins: BasePlugin[]): Required<BasePlugin> {
  const visitTypePlugins: Pick<Required<BasePlugin>, 'visitType'>[] = plugins.filter(
    plugin => plugin.visitType,
  ) as Pick<Required<BasePlugin>, 'visitType'>[];

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

  const beforeSubscribePlugins: Pick<Required<BasePlugin>, 'beforeSubscribe'>[] = plugins.filter(
    plugin => plugin.beforeSubscribe,
  ) as Pick<Required<BasePlugin>, 'beforeSubscribe'>[];

  const onInterfaceResolveTypePlugins: Pick<
    Required<BasePlugin>,
    'onInterfaceResolveType'
  >[] = plugins.filter(plugin => plugin.onInterfaceResolveType) as Pick<
    Required<BasePlugin>,
    'onInterfaceResolveType'
  >[];

  const onUnionResolveTypePlugins: Pick<
    Required<BasePlugin>,
    'onUnionResolveType'
  >[] = plugins.filter(plugin => plugin.onUnionResolveType) as Pick<
    Required<BasePlugin>,
    'onUnionResolveType'
  >[];

  const onTypePlugins: Pick<Required<BasePlugin>, 'onType'>[] = plugins.filter(
    plugin => plugin.onType,
  ) as Pick<Required<BasePlugin>, 'onType'>[];

  const onFieldsPlugins: Pick<Required<BasePlugin>, 'onField'>[] = plugins.filter(
    plugin => plugin.onField,
  ) as Pick<Required<BasePlugin>, 'onField'>[];

  return {
    visitType(entry: BuildCacheEntry, cache: BuildCache) {
      for (const plugin of visitTypePlugins) {
        plugin.visitType(entry, cache);
      }
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

        if (hooks?.onResolve) {
          onResolveFns.push(hooks.onResolve);
        }

        if (hooks?.onWrap) {
          onWrapFns.push(hooks.onWrap);
        }
      }

      return {
        onResolve:
          onResolveFns.length === 0
            ? undefined
            : async (value: unknown) => {
                for (const fn of onResolveFns) {
                  await fn(value);
                }
              },
        onWrap:
          onWrapFns.length === 0
            ? undefined
            : async (child: ResolveValueWrapper) => {
                for (const fn of onWrapFns) {
                  await fn(child);
                }
              },
      };
    },

    async beforeSubscribe(
      parent: ResolveValueWrapper,
      data: GiraphQLSchemaTypes.FieldWrapData,
      args: object,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      const onSubscribeFns: ((value: unknown) => MaybePromise<void>)[] = [];
      const onWrapFns: ((child: ResolveValueWrapper) => MaybePromise<void>)[] = [];

      for (const plugin of beforeSubscribePlugins) {
        const hooks = await plugin.beforeSubscribe(parent, data, args, context, info);

        if (hooks?.onSubscribe) {
          onSubscribeFns.push(hooks.onSubscribe);
        }

        if (hooks?.onWrap) {
          onWrapFns.push(hooks.onWrap);
        }
      }

      return {
        onSubscribe:
          onSubscribeFns.length === 0
            ? undefined
            : async (value: unknown) => {
                for (const fn of onSubscribeFns) {
                  await fn(value);
                }
              },
        onWrap:
          onWrapFns.length === 0
            ? undefined
            : async (child: ResolveValueWrapper) => {
                for (const fn of onWrapFns) {
                  await fn(child);
                }
              },
      };
    },

    async onInterfaceResolveType(
      typename: string,
      parent: ResolveValueWrapper,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of onInterfaceResolveTypePlugins) {
        await plugin.onInterfaceResolveType(typename, parent, context, info);
      }
    },

    async onUnionResolveType(
      typename: string,
      parent: ResolveValueWrapper,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of onUnionResolveTypePlugins) {
        await plugin.onUnionResolveType(typename, parent, context, info);
      }
    },

    onType(type: ImplementedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
      for (const plugin of onTypePlugins) {
        plugin.onType(type, builder);
      }
    },

    onField(
      type: ImplementedType,
      name: string,
      field: Field<{}, any, TypeParam<any>>,
      builder: GiraphQLSchemaTypes.SchemaBuilder<any>,
    ) {
      for (const plugin of onFieldsPlugins) {
        plugin.onField(type, name, field, builder);
      }
    },
  };
}
