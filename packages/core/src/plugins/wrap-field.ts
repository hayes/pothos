/* eslint-disable no-unused-expressions */
import {
  defaultFieldResolver,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
  GraphQLAbstractType,
  GraphQLIsTypeOfFn,
} from 'graphql';
import { SchemaTypes, GiraphQLOutputFieldConfig, GiraphQLOutputFieldType } from '..';
import { ResolveValueWrapper } from './resolve-wrapper';
import BaseFieldWrapper from './field-wrapper';

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

  if (typeof context !== 'object' || !context) {
    throw new TypeError('Expected context to be a unique object');
  }

  requestDataStore.set(context, data);

  return data;
}

export function getFieldKind<Types extends SchemaTypes>(type: GiraphQLOutputFieldType<Types>) {
  if (type.kind === 'List') {
    return type.type.kind;
  }

  return type.kind;
}

export function wrapResolver<Types extends SchemaTypes>(
  config: GiraphQLOutputFieldConfig<Types>,
  fieldWrapper: Required<BaseFieldWrapper<Types>>,
) {
  const originalResolver = config.resolve || defaultFieldResolver;

  const isListResolver = config.type.kind === 'List';
  const fieldKind = getFieldKind(config.type);
  const isScalarResolver = fieldKind === 'Scalar' || fieldKind === 'Enum';

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

      const childData =
        ((await resolveHooks?.onWrap?.(wrapped, index)) as Record<string, object | null>) ?? {};

      wrapped.data = childData;

      if (fieldKind === 'Interface') {
        wrapped.resolveType = (type, ...rest) => {
          fieldWrapper.onInterfaceResolveType(requestData, childData, type, ...rest);
        };
      } else if (fieldKind === 'Union') {
        wrapped.resolveType = (type, ...rest) => {
          fieldWrapper.onUnionResolveType(requestData, childData, type, ...rest);
        };
      }

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

      return wrappedList;
    }

    return wrapChild(result, null);
  };

  wrappedResolver.unwrap = () => originalResolver;

  return wrappedResolver;
}

export function wrapSubscriber<Types extends SchemaTypes>(
  config: GiraphQLOutputFieldConfig<Types>,
  fieldWrapper: Required<BaseFieldWrapper<Types>>,
) {
  const originalSubscribe = config.subscribe;

  if (!originalSubscribe) {
    return originalSubscribe;
  }

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

  wrappedSubscribe.unwrap = () => originalSubscribe;

  return wrappedSubscribe;
}

export function wrapResolveType<Types extends SchemaTypes>(
  originalResolveType?: GraphQLTypeResolver<unknown, Types['Context']> | null,
) {
  return async function resolveType(
    originalParent: unknown,
    context: Types['Context'],
    info: GraphQLResolveInfo,
    abstractType: GraphQLAbstractType,
  ) {
    const parent = ResolveValueWrapper.wrap(originalParent);

    const type = (await originalResolveType?.(parent.value, context, info, abstractType)) ?? null;

    if (!type) {
      return type;
    }

    if (parent.resolveType) {
      await parent.resolveType(type, parent.value, context, info, abstractType);
    }

    return type;
  };
}

export function wrapIsTypeOf<Types extends SchemaTypes>(
  originalIsTypeOfFn: GraphQLIsTypeOfFn<unknown, Types['Context']>,
) {
  return async function isTypeOf(
    originalParent: unknown,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) {
    const parent = ResolveValueWrapper.wrap(originalParent);

    return originalIsTypeOfFn(parent, context, info);
  };
}
