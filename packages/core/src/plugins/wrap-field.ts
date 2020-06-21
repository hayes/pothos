/* eslint-disable no-unused-expressions */
import { defaultFieldResolver, GraphQLResolveInfo } from 'graphql';
import { SchemaTypes, GiraphQLOutputFieldConfig } from '..';
import { BasePlugin } from './plugin';
import { ResolveValueWrapper } from './resolve-wrapper';
import { mergeFieldWrappers } from './merge-field-wrappers';

function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('List resolvers must return arrays');
  }

  return true;
}

const requestDataStore = new WeakMap<object, {}>();

function getRequestData(context: object) {
  if (requestDataStore.has(context)) {
    return requestDataStore.get(context)!;
  }

  const data = {};

  requestDataStore.set(context, data);

  return data;
}

export function wrapField<Types extends SchemaTypes>(
  config: GiraphQLOutputFieldConfig<Types>,
  plugin: Required<BasePlugin<Types>>,
) {
  const originalResolver = config.resolve || defaultFieldResolver;
  const originalSubscribe = config.subscribe;

  const isListResolver = config.type.kind === 'List';
  const isScalarResolver =
    config.type.kind === 'List'
      ? config.type.type.kind === 'Scalar'
      : config.type.kind === 'Scalar';

  const fieldWrapper = mergeFieldWrappers(config, plugin.wrapOutputField(config));

  const wrappedResolver = async (
    originalParent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const parent = ResolveValueWrapper.wrap(originalParent);
    const requestData = getRequestData(context);

    const resolveHooks = await fieldWrapper.beforeResolve(
      requestData,
      parent.data,
      parent.value,
      args,
      context,
      info,
    );

    const resolver = resolveHooks.overwriteResolve || originalResolver;

    const result = await resolver(parent.value, args, context, info);

    async function wrapChild(child: unknown, index: number | null) {
      if (child == null) {
        return null;
      }

      // Handle cases where overwriteResolve returns cached result
      if (child instanceof ResolveValueWrapper) {
        return child;
      }

      const wrapped = parent.child(child);

      wrapped.data =
        ((await resolveHooks?.onWrap?.(wrapped, index)) as Record<string, object | null>) ?? {};

      return wrapped;
    }

    await resolveHooks?.onResolve?.(result);

    if (result === null || result === undefined || isScalarResolver) {
      return result as unknown;
    }

    if (isListResolver && assertArray(result)) {
      const wrappedList = result.map((item, i) =>
        Promise.resolve(item).then((value) => wrapChild(value, i)),
      );

      resolveHooks.onWrappedResolve?.(wrappedList);
    }

    return wrapChild(result, null);
  };

  const wrappedSubscribe = async (
    originalParent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const parent = ResolveValueWrapper.wrap(originalParent);
    const requestData = getRequestData(context);

    const subscribeHook = await fieldWrapper.beforeSubscribe(
      requestData,
      parent.value,
      args,
      context,
      info,
    );

    const result: AsyncIterable<unknown> = await originalSubscribe!(
      parent.value,
      args,
      context,
      info,
    );

    await subscribeHook?.onSubscribe?.(result);

    if (!result) {
      return result;
    }

    return {
      [Symbol.asyncIterator]: () => {
        if (typeof result[Symbol.asyncIterator] !== 'function') {
          return result;
        }

        const iter = result[Symbol.asyncIterator]();

        return {
          next: async () => {
            const { done, value } = await iter.next();

            // Handle cases where overwriteResolve returns cached result
            if (value instanceof ResolveValueWrapper) {
              return { value, done };
            }

            const wrapped = parent.child(value);

            wrapped.data =
              ((await subscribeHook?.onWrap?.(wrapped)) as Record<string, object | null>) ?? {};

            return { value: wrapped, done };
          },
          return: iter.return?.bind(iter),
          throw: iter.throw?.bind(iter),
        };
      },
    };
  };

  wrappedResolver.unwrap = () => originalResolver;
  wrappedSubscribe.unwrap = () => originalSubscribe;

  return { resolve: wrappedResolver, subscribe: originalSubscribe ? wrappedSubscribe : undefined };
}
