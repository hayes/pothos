/* eslint-disable no-await-in-loop */
import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';

import {
  MaybePromise,
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  GiraphQLObjectTypeConfig,
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

    allowReuse(
      requestData: RequestData,
      parentData: ParentData | null,
      parent: unknown,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) {
      for (const plugin of allowReusePlugins) {
        if (plugin.allowReuse(requestData, parentData, parent, args, context, info)) {
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

      let overwriteResolve:
        | ((
            parent: unknown,
            args: {},
            context: Types['Context'],
            info: GraphQLResolveInfo,
            originalResolver: GraphQLFieldResolver<unknown, Types['Context']>,
          ) => unknown)
        | undefined;

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

        if (hooks?.onChild) {
          onChildFns.push([plugin.name, hooks.onChild]);
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
