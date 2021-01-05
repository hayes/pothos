/* eslint-disable promise/always-return, no-plusplus */
import { GraphQLResolveInfo, GraphQLFieldResolver } from 'graphql';
import { types } from 'util';

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
): BaseFieldWrapper<Types> {
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

    createRequestData:
      createRequestDataPlugins.length > 0
        ? (context: Types['Context']) => {
            const requestData: RequestData = {};

            for (const plugin of createRequestDataPlugins) {
              requestData[plugin.name] = plugin.createRequestData(context);
            }

            return requestData;
          }
        : undefined,

    allowReuse:
      allowReusePlugins.length > 0
        ? (
            requestData: RequestData,
            parentData: ParentData | null,
            parent: unknown,
            args: object,
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) =>
            maybeAsyncForEach(
              allowReusePlugins,
              (plugin, earlyReturn) => {
                const maybePromise = plugin.allowReuse(
                  requestData[plugin.name] ?? null,
                  parentData?.[plugin.name] ?? null,
                  parent,
                  args,
                  context,
                  info,
                );

                if (types.isPromise(maybePromise)) {
                  return maybePromise.then((result) => {
                    if (result) {
                      earlyReturn(true);
                    }
                  });
                }

                if (maybePromise) {
                  earlyReturn(true);
                }

                return null;
              },
              () => false as boolean,
            )
        : undefined,

    beforeResolve:
      beforeResolvePlugins.length > 0
        ? (
            requestData: RequestData,
            parentData: ParentData | null,
            parent: unknown,
            args: object,
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) => {
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

            return maybeAsyncForEach(
              beforeResolvePlugins,
              (plugin) => {
                const pluginRequestData =
                  requestData?.[plugin.name] ?? plugin.createRequestData?.(context) ?? {};

                const maybePromise = plugin.beforeResolve(
                  pluginRequestData,
                  parentData?.[plugin.name] ?? null,
                  parent,
                  args,
                  context,
                  info,
                );

                if (types.isPromise(maybePromise)) {
                  return maybePromise.then(addHooks);
                }

                addHooks(maybePromise);

                function addHooks(hooks: ResolveHooks<Types, object>) {
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

                return null;
              },
              () => {
                const overwriteResolve: ResolveHooks<Types, unknown>['overwriteResolve'] =
                  overwriteResolveFns.length === 0
                    ? undefined
                    : (_parent, _args, _context, _info, originalResolve) => {
                        function resolverFor(
                          i: number,
                        ): GraphQLFieldResolver<unknown, Types['Context']> {
                          if (i >= overwriteResolveFns.length) {
                            return originalResolve;
                          }

                          return (...resolveArgs) =>
                            overwriteResolveFns[i](
                              resolveArgs[0],
                              resolveArgs[1],
                              resolveArgs[2],
                              resolveArgs[3],
                              resolverFor(i + 1),
                            );
                        }

                        return resolverFor(0)(_parent, _args, _context, _info) as unknown;
                      };

                return {
                  overwriteResolve,
                  onResolve:
                    onResolveFns.length === 0
                      ? undefined
                      : (value: unknown) =>
                          maybeAsyncForEach(
                            onResolveFns,
                            (fn) => fn(value),
                            () => {},
                          ),
                  onChild:
                    onChildFns.length === 0
                      ? undefined
                      : (
                          child: unknown,
                          index: number | null,
                          type: GiraphQLObjectTypeConfig,
                          update: (value: unknown) => void,
                        ) => {
                          const childData: ParentData = {};

                          return maybeAsyncForEach(
                            onChildFns,
                            ([name, fn]) => {
                              const maybePromise = fn(child, index, type, update);

                              if (types.isPromise(maybePromise)) {
                                return maybePromise.then((value) => {
                                  childData[name] = value;
                                });
                              }

                              childData[name] = maybePromise;

                              return null;
                            },
                            () => childData,
                          );
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
            );
          }
        : undefined,

    beforeSubscribe:
      beforeSubscribePlugins.length > 0
        ? (
            requestData: RequestData,
            parent: unknown,
            args: object,
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) => {
            const onSubscribeFns: ((value: unknown) => MaybePromise<void>)[] = [];
            const onValueFns: [string, (child: unknown) => MaybePromise<object | null>][] = [];

            const overwriteSubscribeFns: NonNullable<
              SubscribeHooks<Types, unknown>['overwriteSubscribe']
            >[] = [];

            return maybeAsyncForEach(
              beforeSubscribePlugins,
              (plugin) => {
                const pluginRequestData =
                  requestData?.[plugin.name] ?? plugin.createRequestData?.(context) ?? {};

                const maybePromise = plugin.beforeSubscribe(
                  pluginRequestData,
                  parent,
                  args,
                  context,
                  info,
                );

                if (types.isPromise(maybePromise)) {
                  return maybePromise.then(addHooks);
                }

                addHooks(maybePromise);

                return null;

                function addHooks(hooks: SubscribeHooks<Types, object>) {
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
              },
              () => {
                const overwriteSubscribe: SubscribeHooks<Types, unknown>['overwriteSubscribe'] =
                  overwriteSubscribeFns.length === 0
                    ? undefined
                    : (_parent, _args, _context, _info, originalResolve) => {
                        function resolverFor(
                          i: number,
                        ): GraphQLFieldResolver<unknown, Types['Context']> {
                          if (i >= overwriteSubscribeFns.length) {
                            return originalResolve;
                          }

                          return (...resolveArgs) =>
                            overwriteSubscribeFns[i](
                              resolveArgs[0],
                              resolveArgs[1],
                              resolveArgs[2],
                              resolveArgs[3],
                              resolverFor(i + 1),
                            );
                        }

                        return resolverFor(0)(_parent, _args, _context, _info) as unknown;
                      };

                return {
                  overwriteSubscribe,
                  onSubscribe:
                    onSubscribeFns.length === 0
                      ? undefined
                      : (value: unknown) =>
                          maybeAsyncForEach(
                            onSubscribeFns,
                            (fn) => fn(value),
                            () => {},
                          ),
                  onValue:
                    onValueFns.length === 0
                      ? undefined
                      : (child: unknown) => {
                          const childData: ParentData = {};

                          return maybeAsyncForEach(
                            onValueFns,
                            ([name, fn]) => {
                              const maybePromise = fn(child);

                              if (types.isPromise(maybePromise)) {
                                return maybePromise.then((value) => {
                                  childData[name] = value;
                                });
                              }

                              childData[name] = maybePromise;

                              return null;
                            },
                            () => childData,
                          );
                        },
                };
              },
            );
          }
        : undefined,
  };
}

function maybeAsyncForEach<T, U>(
  list: MaybePromise<T>[],
  each: (item: T, earlyReturn: (val: U) => void, offset: number) => MaybePromise<unknown>,
  then: () => MaybePromise<U>,
): MaybePromise<U> {
  let returned = false;
  let returnVal: U;
  let current = 0;

  return next(null);

  function next(prev: unknown): MaybePromise<U> {
    if (types.isPromise(prev)) {
      // eslint-disable-next-line promise/no-callback-in-promise
      return prev.then(next);
    }

    if (returned) {
      return returnVal;
    }

    if (current >= list.length) {
      return then();
    }

    const item = list[current];

    if (types.isPromise(item)) {
      // eslint-disable-next-line arrow-body-style
      return item.then((realItem) => {
        // eslint-disable-next-line promise/no-callback-in-promise,
        return next(each(realItem, earlyReturn, current++));
      });
    }

    return next(each(item, earlyReturn, current++));
  }

  function earlyReturn(val: U) {
    returned = true;
    returnVal = val;
  }
}
