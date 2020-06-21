/* eslint-disable no-await-in-loop */
import { GraphQLResolveInfo, GraphQLFieldResolver, GraphQLAbstractType } from 'graphql';

import { MaybePromise, SchemaTypes, GiraphQLOutputFieldConfig } from '../types';
import { ResolveValueWrapper } from './resolve-wrapper';
import BaseFieldWrapper from './field-wrapper';

type RequestData = Record<string, object>;
type ParentData = Record<string, object | null>;

export function mergeFieldWrappers<Types extends SchemaTypes>(
  field: GiraphQLOutputFieldConfig<Types>,
  rawFieldWrappers: BaseFieldWrapper<Types>[] | BaseFieldWrapper<Types> | null,
): Required<BaseFieldWrapper<Types>> {
  let fieldWrappers;

  if (Array.isArray(rawFieldWrappers)) {
    fieldWrappers = rawFieldWrappers;
  } else {
    fieldWrappers = rawFieldWrappers ? [rawFieldWrappers] : [];
  }

  const beforeResolvePlugins: (BaseFieldWrapper<Types> &
    Pick<Required<BaseFieldWrapper<Types>>, 'beforeResolve'>)[] = fieldWrappers.filter(
    (plugin) => plugin.beforeResolve,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'beforeResolve'>)[];

  const beforeSubscribePlugins: (BaseFieldWrapper<Types> &
    Pick<Required<BaseFieldWrapper<Types>>, 'beforeSubscribe'>)[] = fieldWrappers.filter(
    (plugin) => plugin.beforeSubscribe,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'beforeSubscribe'>)[];

  const onInterfaceResolveTypePlugins: Pick<
    Required<BaseFieldWrapper<Types>>,
    'onInterfaceResolveType'
  >[] = fieldWrappers.filter((plugin) => plugin.onInterfaceResolveType) as Pick<
    Required<BaseFieldWrapper<Types>>,
    'onInterfaceResolveType'
  >[];

  const onUnionResolveTypePlugins: Pick<
    Required<BaseFieldWrapper<Types>>,
    'onUnionResolveType'
  >[] = fieldWrappers.filter((plugin) => plugin.onUnionResolveType) as Pick<
    Required<BaseFieldWrapper<Types>>,
    'onUnionResolveType'
  >[];

  return {
    name: 'GiraphQLMergedFieldWrapper',

    field,

    createRequestData() {
      return {};
    },

    async beforeResolve(
      requestData: RequestData,
      parentData: ParentData | null,
      parent: unknown,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) {
      const onResolveFns: ((value: unknown) => MaybePromise<void>)[] = [];
      const onWrapFns: [
        string,
        (child: ResolveValueWrapper, index: number | null) => MaybePromise<object | null>,
      ][] = [];
      const onWrappedResolveFns: ((
        wrapped: ResolveValueWrapper | MaybePromise<ResolveValueWrapper | null>[],
      ) => void)[] = [];

      let overwriteResolve: GraphQLFieldResolver<unknown, Types['Context']> | undefined;

      for (const plugin of beforeResolvePlugins) {
        const pluginRequestData =
          requestData?.[plugin.name] ?? plugin.createRequestData?.(context) ?? {};

        const hooks = await plugin.beforeResolve(
          pluginRequestData,
          parentData?.[plugin.name] ?? null,
          parent,
          args,
          context,
          info,
        );

        if (hooks?.onResolve) {
          onResolveFns.push(hooks.onResolve);
        }

        if (hooks?.onWrap) {
          onWrapFns.push([plugin.name, hooks.onWrap]);
        }

        overwriteResolve = overwriteResolve || hooks.overwriteResolve;
      }

      return {
        overwriteResolve,
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
            : async (child: ResolveValueWrapper, index: number | null) => {
                const childData: ParentData = {};
                for (const [name, fn] of onWrapFns) {
                  childData[name] = await fn(child, index);
                }

                return childData;
              },
        onWrappedResolve:
          onWrappedResolveFns.length === 0
            ? undefined
            : (wrapped: ResolveValueWrapper | MaybePromise<ResolveValueWrapper | null>[]) => {
                for (const fn of onWrappedResolveFns) {
                  fn(wrapped);
                }
              },
      };
    },

    async beforeSubscribe(
      requestData: RequestData,
      parent: unknown,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) {
      const onSubscribeFns: ((value: unknown) => MaybePromise<void>)[] = [];
      const onWrapFns: [string, (child: ResolveValueWrapper) => MaybePromise<object | null>][] = [];

      for (const plugin of beforeSubscribePlugins) {
        const pluginRequestData =
          requestData?.[plugin.name] ?? plugin.createRequestData?.(context) ?? {};
        const hooks = await plugin.beforeSubscribe(pluginRequestData, parent, args, context, info);

        if (hooks?.onSubscribe) {
          onSubscribeFns.push(hooks.onSubscribe);
        }

        if (hooks?.onWrap) {
          onWrapFns.push([plugin.name, hooks.onWrap]);
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
                const childData: ParentData = {};
                for (const [name, fn] of onWrapFns) {
                  childData[name] = await fn(child);
                }
                return childData;
              },
      };
    },

    async onInterfaceResolveType(
      requestData: RequestData,
      parentData: ParentData | null,
      type: string,
      parent: unknown,
      context: object,
      info: GraphQLResolveInfo,
      abstractType: GraphQLAbstractType,
    ) {
      for (const plugin of onInterfaceResolveTypePlugins) {
        await plugin.onInterfaceResolveType(
          requestData,
          parentData,
          type,
          parent,
          context,
          info,
          abstractType,
        );
      }
    },

    async onUnionResolveType(
      requestData: RequestData,
      parentData: ParentData | null,
      type: string,
      parent: unknown,
      context: object,
      info: GraphQLResolveInfo,
      abstractType: GraphQLAbstractType,
    ) {
      for (const plugin of onUnionResolveTypePlugins) {
        await plugin.onUnionResolveType(
          requestData,
          parentData,
          type,
          parent,
          context,
          info,
          abstractType,
        );
      }
    },
  };
}
