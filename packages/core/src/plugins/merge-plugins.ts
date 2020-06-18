/* eslint-disable no-await-in-loop */
import {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLInterfaceType,
} from 'graphql';
import { BasePlugin } from '..';
import { MaybePromise } from '../types';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export function mergePlugins(plugins: BasePlugin[]): Required<BasePlugin> {
  const visitTypePlugins: Pick<Required<BasePlugin>, 'visitType'>[] = plugins.filter(
    (plugin) => plugin.visitType,
  ) as Pick<Required<BasePlugin>, 'visitType'>[];

  const updateFieldConfigPlugins: Pick<
    Required<BasePlugin>,
    'updateFieldConfig'
  >[] = plugins.filter((plugin) => plugin.updateFieldConfig) as Pick<
    Required<BasePlugin>,
    'updateFieldConfig'
  >[];

  const onFieldWrapPlugins: Pick<Required<BasePlugin>, 'onFieldWrap'>[] = plugins.filter(
    (plugin) => plugin.onFieldWrap,
  ) as Pick<Required<BasePlugin>, 'onFieldWrap'>[];

  const beforeResolvePlugins: Pick<Required<BasePlugin>, 'beforeResolve'>[] = plugins.filter(
    (plugin) => plugin.beforeResolve,
  ) as Pick<Required<BasePlugin>, 'beforeResolve'>[];

  const beforeSubscribePlugins: Pick<Required<BasePlugin>, 'beforeSubscribe'>[] = plugins.filter(
    (plugin) => plugin.beforeSubscribe,
  ) as Pick<Required<BasePlugin>, 'beforeSubscribe'>[];

  const onInterfaceResolveTypePlugins: Pick<
    Required<BasePlugin>,
    'onInterfaceResolveType'
  >[] = plugins.filter((plugin) => plugin.onInterfaceResolveType) as Pick<
    Required<BasePlugin>,
    'onInterfaceResolveType'
  >[];

  const onUnionResolveTypePlugins: Pick<
    Required<BasePlugin>,
    'onUnionResolveType'
  >[] = plugins.filter((plugin) => plugin.onUnionResolveType) as Pick<
    Required<BasePlugin>,
    'onUnionResolveType'
  >[];

  const onTypePlugins: Pick<Required<BasePlugin>, 'onType'>[] = plugins.filter(
    (plugin) => plugin.onType,
  ) as Pick<Required<BasePlugin>, 'onType'>[];

  const onFieldPlugins: Pick<Required<BasePlugin>, 'onField'>[] = plugins.filter(
    (plugin) => plugin.onField,
  ) as Pick<Required<BasePlugin>, 'onField'>[];

  const beforeBuildPlugins: Pick<Required<BasePlugin>, 'beforeBuild'>[] = plugins.filter(
    (plugin) => plugin.beforeBuild,
  ) as Pick<Required<BasePlugin>, 'beforeBuild'>[];

  const afterBuildPlugins: Pick<Required<BasePlugin>, 'afterBuild'>[] = plugins.filter(
    (plugin) => plugin.afterBuild,
  ) as Pick<Required<BasePlugin>, 'afterBuild'>[];

  return {
    visitType(type: GraphQLNamedType, cache: BuildCache) {
      for (const plugin of visitTypePlugins) {
        plugin.visitType(type, cache);
      }
    },

    updateFieldConfig(
      type: GraphQLObjectType | GraphQLInterfaceType,
      name: string,
      config: GraphQLFieldConfig<unknown, object>,
      cache: BuildCache,
    ) {
      return updateFieldConfigPlugins.reduce(
        (newConfig, plugin) => plugin.updateFieldConfig(type, name, newConfig, cache),
        config,
      );
    },

    onFieldWrap(
      type: GraphQLObjectType | GraphQLInterfaceType,
      name: string,
      config: GraphQLFieldConfig<unknown, object>,
      data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
      cache: BuildCache,
    ) {
      for (const plugin of onFieldWrapPlugins) {
        plugin.onFieldWrap(type, name, config, data, cache);
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
      const onWrapFns: ((
        child: ResolveValueWrapper,
        index: number | null,
        wrap: (child: unknown) => MaybePromise<ResolveValueWrapper>,
      ) => MaybePromise<void>)[] = [];

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
            : async (
                child: ResolveValueWrapper,
                index: number | null,
                wrap: (child: unknown) => MaybePromise<ResolveValueWrapper>,
              ) => {
                for (const fn of onWrapFns) {
                  await fn(child, index, wrap);
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
      type: GraphQLObjectType,
      parent: ResolveValueWrapper,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of onInterfaceResolveTypePlugins) {
        await plugin.onInterfaceResolveType(type, parent, context, info);
      }
    },

    async onUnionResolveType(
      type: GraphQLObjectType,
      parent: ResolveValueWrapper,
      context: object,
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of onUnionResolveTypePlugins) {
        await plugin.onUnionResolveType(type, parent, context, info);
      }
    },

    onType(type: GraphQLNamedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
      for (const plugin of onTypePlugins) {
        plugin.onType(type, builder);
      }
    },

    onField(
      type: GraphQLObjectType | GraphQLInterfaceType,
      name: string,
      field: GraphQLFieldConfig<unknown, object>,
      builder: GiraphQLSchemaTypes.SchemaBuilder<any>,
    ) {
      for (const plugin of onFieldPlugins) {
        plugin.onField(type, name, field, builder);
      }
    },

    beforeBuild(builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
      for (const plugin of beforeBuildPlugins) {
        plugin.beforeBuild(builder);
      }
    },

    afterBuild(schema: GraphQLSchema, builder: GiraphQLSchemaTypes.SchemaBuilder<any>) {
      for (const plugin of afterBuildPlugins) {
        plugin.afterBuild(schema, builder);
      }
    },
  };
}
