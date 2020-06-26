/* eslint-disable no-await-in-loop */
import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';

import {
  MaybePromise,
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  GiraphQLObjectTypeConfig,
  ResolveHooks,
  SubscribeHooks,
} from '../types';
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

  const beforeResolvePlugins = fieldWrappers.filter(
    (plugin) => plugin.beforeResolve,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'beforeResolve'>)[];

  const beforeSubscribePlugins = fieldWrappers.filter(
    (plugin) => plugin.beforeSubscribe,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'beforeSubscribe'>)[];

  const createRequestDataPlugins = fieldWrappers.filter(
    (plugin) => plugin.createRequestData,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'createRequestData'>)[];

  const allowReusePlugins = fieldWrappers.filter(
    (plugin) => plugin.createRequestData,
  ) as (BaseFieldWrapper<Types> & Pick<Required<BaseFieldWrapper<Types>>, 'allowReuse'>)[];

  return {
    name: 'GiraphQLMergedFieldWrapper',

    field,

    createRequestData(context: Types['Context']) {
      const requestData: RequestData = {};

      for (const plugin of createRequestDataPlugins) {
        requestData[plugin.name] = plugin.createRequestData(context);
      }

      return requestData;
    },

    async allowReuse(
      requestData: RequestData,
      parentData: ParentData | null,
      parent: unknown,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of allowReusePlugins) {
        if (
          await plugin.allowReuse(
            requestData[plugin.name] ?? null,
            parentData?.[plugin.name] ?? null,
            parent,
            args,
            context,
            info,
          )
        ) {
          return true;
        }
      }

      return false;
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
      const onChildFns: [
        string,
        (
          child: unknown,
          index: number | null,
          type: GiraphQLObjectTypeConfig,
          update: (value: unknown) => void,
        ) => MaybePromise<object | null>,
      ][] = [];
      const onWrappedResolveFns: ((wrapped: unknown) => void)[] = [];

      const overwriteResolveFns: NonNullable<
        ResolveHooks<Types, unknown>['overwriteResolve']
      >[] = [];

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

        if (hooks?.onWrappedResolve) {
          onWrappedResolveFns.push(hooks.onWrappedResolve);
        }

        if (hooks?.onChild) {
          onChildFns.push([plugin.name, hooks.onChild]);
        }

        if (hooks.overwriteResolve) {
          overwriteResolveFns.push(hooks.overwriteResolve);
        }
      }

      const overwriteResolve: ResolveHooks<Types, unknown>['overwriteResolve'] =
        overwriteResolveFns.length === 0
          ? undefined
          : (parent, args, context, info, orignalResolve) => {
              return resolverFor(0)(parent, args, context, info);

              function resolverFor(i: number): GraphQLFieldResolver<unknown, Types['Context']> {
                if (i >= overwriteResolveFns.length) {
                  return orignalResolve;
                }

                return (parent, args, context, info) => {
                  return overwriteResolveFns[i](parent, args, context, info, resolverFor(i + 1));
                };
              }
            };

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
        onChild:
          onChildFns.length === 0
            ? undefined
            : async (
                child: unknown,
                index: number | null,
                type: GiraphQLObjectTypeConfig,
                update: (value: unknown) => void,
              ) => {
                const childData: ParentData = {};
                for (const [name, fn] of onChildFns) {
                  childData[name] = await fn(child, index, type, update);
                }

                return childData;
              },
        onWrappedResolve:
          onWrappedResolveFns.length === 0
            ? undefined
            : (wrapped: unknown) => {
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
      const onValueFns: [string, (child: unknown) => MaybePromise<object | null>][] = [];

      const overwriteSubscribeFns: NonNullable<
        SubscribeHooks<Types, unknown>['overwriteSubscribe']
      >[] = [];

      for (const plugin of beforeSubscribePlugins) {
        const pluginRequestData =
          requestData?.[plugin.name] ?? plugin.createRequestData?.(context) ?? {};
        const hooks = await plugin.beforeSubscribe(pluginRequestData, parent, args, context, info);

        if (hooks?.onSubscribe) {
          onSubscribeFns.push(hooks.onSubscribe);
        }

        if (hooks?.onValue) {
          onValueFns.push([plugin.name, hooks.onValue]);
        }

        if (hooks.overwriteSubscribe) {
          overwriteSubscribeFns.push(hooks.overwriteSubscribe);
        }
      }

      const overwriteSubscribe: SubscribeHooks<Types, unknown>['overwriteSubscribe'] =
        overwriteSubscribeFns.length === 0
          ? undefined
          : (parent, args, context, info, orignalResolve) => {
              return resolverFor(0)(parent, args, context, info);

              function resolverFor(i: number): GraphQLFieldResolver<unknown, Types['Context']> {
                if (i >= overwriteSubscribeFns.length) {
                  return orignalResolve;
                }

                return (parent, args, context, info) => {
                  return overwriteSubscribeFns[i](parent, args, context, info, resolverFor(i + 1));
                };
              }
            };

      return {
        overwriteSubscribe,
        onSubscribe:
          onSubscribeFns.length === 0
            ? undefined
            : async (value: unknown) => {
                for (const fn of onSubscribeFns) {
                  await fn(value);
                }
              },
        onValue:
          onValueFns.length === 0
            ? undefined
            : async (child: unknown) => {
                const childData: ParentData = {};
                for (const [name, fn] of onValueFns) {
                  childData[name] = await fn(child);
                }
                return childData;
              },
      };
    },
  };
}
