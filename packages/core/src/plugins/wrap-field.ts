import {
  defaultFieldResolver,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
  GraphQLAbstractType,
} from 'graphql';
import { types } from 'util';
import { SchemaTypes, GiraphQLOutputFieldConfig, GiraphQLTypeConfig, MaybePromise } from '..';
import { ResolveValueWrapper, ValueWrapper } from './resolve-wrapper';
import BaseFieldWrapper from './field-wrapper';
import ConfigStore from '../config-store';
import { assertArray } from '../utils';

const requestDataStore = new WeakMap<object, {}>();

function getRequestData(context: object, createRequestData: () => {}) {
  if (typeof context !== 'object' || !context) {
    throw new TypeError('Expected context to be a unique object');
  }

  if (requestDataStore.has(context)) {
    return requestDataStore.get(context)!;
  }

  const data = createRequestData();

  requestDataStore.set(context, data);

  return data;
}

export function wrapResolver<Types extends SchemaTypes>(
  config: GiraphQLOutputFieldConfig<Types>,
  fieldWrapper: Required<BaseFieldWrapper<Types>>,
  returnType: GiraphQLTypeConfig,
) {
  const originalResolver = config.resolve || defaultFieldResolver;

  if (
    returnType.kind === 'Query' ||
    returnType.kind === 'Mutation' ||
    returnType.kind === 'Subscription' ||
    returnType.kind === 'InputObject'
  ) {
    throw new TypeError(`Return type ${returnType.kind} is not a valid return type`);
  }

  const isListResolver = config.type.kind === 'List';
  const isScalarResolver = returnType.kind === 'Scalar' || returnType.kind === 'Enum';

  const wrappedResolver = async (
    originalParent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const parentOrPromise =
      originalParent instanceof ValueWrapper ? originalParent.unwrap() : originalParent;
    const parentValue = types.isPromise(parentOrPromise)
      ? ((await parentOrPromise) as unknown)
      : parentOrPromise;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parentDataOrPromise: {} | Promise<{}> =
      originalParent instanceof ValueWrapper ? originalParent.getData() : {};
    const parentData = types.isPromise(parentDataOrPromise)
      ? await parentDataOrPromise
      : parentDataOrPromise;

    const requestData = getRequestData(context, () => fieldWrapper.createRequestData(context));

    if (originalParent instanceof ValueWrapper && originalParent.hasFieldResult(info)) {
      const allowReuse = fieldWrapper.allowReuse(
        requestData,
        parentData,
        parentValue,
        args,
        config,
        info,
      );

      if (types.isPromise(allowReuse) ? await allowReuse : allowReuse) {
        return originalParent.getFieldResult(info, isListResolver);
      }
    }

    const resolveHooksOrPromise = fieldWrapper.beforeResolve(
      requestData,
      parentData,
      parentValue,
      args,
      context,
      info,
    );

    const resolveHooks = types.isPromise(resolveHooksOrPromise)
      ? await resolveHooksOrPromise
      : resolveHooksOrPromise;

    const resultOrPromise: unknown = resolveHooks.overwriteResolve
      ? resolveHooks.overwriteResolve(parentValue, args, context, info, originalResolver)
      : originalResolver(parentValue, args, context, info);

    const result: unknown = types.isPromise(resultOrPromise)
      ? await resultOrPromise
      : resultOrPromise;

    await resolveHooks?.onResolve?.(result);

    const wrapChild = (child: unknown, index: number | null) => {
      if (child == null) {
        return null;
      }

      // Handle cases where overwriteResolve returns cached result
      if (child instanceof ResolveValueWrapper) {
        return child;
      }

      const wrapped = new ResolveValueWrapper(child, index, resolveHooks);

      if (returnType.graphqlKind === 'Object') {
        wrapped.type = returnType;

        const maybePromise = wrapped.updateData(returnType);

        if (types.isPromise(maybePromise)) {
          return maybePromise.then(() => wrapped);
        }

        return wrapped;
      }

      return wrapped;
    };

    const wrapResult = (resultValue: unknown) => {
      if (resultValue === null || resultValue === undefined || isScalarResolver) {
        return resultValue;
      }

      if (isListResolver && assertArray(resultValue)) {
        const wrappedList: MaybePromise<ResolveValueWrapper<
          Types,
          unknown
        > | null>[] = resultValue.map((item, i) => {
          if (types.isPromise(item)) {
            return Promise.resolve(item)
              .then((value) => wrapChild(value, i))
              .then((wrapped) => {
                wrappedList[i] = wrapped;

                return wrapped;
              });
          }

          const maybePromise = wrapChild(item, i);

          if (types.isPromise(maybePromise)) {
            return maybePromise.then((wrapped) => {
              wrappedList[i] = wrapped;

              return wrapped;
            });
          }

          return maybePromise;
        });

        return wrappedList;
      }

      return wrapChild(resultValue, null);
    };

    const wrappedResultOrPromise = wrapResult(result);
    const wrappedResult = types.isPromise(wrappedResultOrPromise)
      ? ((await wrappedResultOrPromise) as unknown)
      : wrappedResultOrPromise;

    const onResolvedPromise = resolveHooks?.onWrappedResolve?.(wrappedResult);

    if (types.isPromise(onResolvedPromise)) {
      await onResolvedPromise;
    }

    if (originalParent instanceof ValueWrapper) {
      originalParent.setFieldResult(info, wrappedResult);
    }

    return wrappedResult;
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
    const requestData = getRequestData(context, () => fieldWrapper.createRequestData(context));

    const subscribeHookOrPromise = fieldWrapper.beforeSubscribe(
      requestData,
      originalParent,
      args,
      context,
      info,
    );

    const subscribeHook = types.isPromise(subscribeHookOrPromise)
      ? await subscribeHookOrPromise
      : subscribeHookOrPromise;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const resultOrPromise: MaybePromise<AsyncIterable<unknown>> = subscribeHook.overwriteSubscribe
      ? subscribeHook.overwriteSubscribe(originalParent, args, context, info, originalSubscribe)
      : originalSubscribe(originalParent, args, context, info);

    const result = types.isPromise(resultOrPromise) ? await resultOrPromise : resultOrPromise;

    await subscribeHook?.onSubscribe?.(result);

    if (result == null) {
      return null;
    }

    return {
      [Symbol.asyncIterator]: () => {
        if (typeof result[Symbol.asyncIterator] !== 'function') {
          return result;
        }

        const iter = result[Symbol.asyncIterator]();

        return {
          next: async () => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const { done, value } = await iter.next();

            const childData =
              ((await subscribeHook?.onValue?.(value)) as Record<string, object | null>) ?? null;

            if (value instanceof ValueWrapper) {
              value.getData = () => childData;

              return { value, done };
            }

            return { value: new ValueWrapper(value, childData), done };
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
  configStore: ConfigStore<Types>,
  originalResolveType?: GraphQLTypeResolver<unknown, Types['Context']> | null,
) {
  return async function resolveType(
    originalParent: unknown,
    context: Types['Context'],
    info: GraphQLResolveInfo,
    abstractType: GraphQLAbstractType,
  ) {
    const parentValue =
      originalParent instanceof ValueWrapper ? await originalParent.unwrap() : originalParent;

    const type = (await originalResolveType?.(parentValue, context, info, abstractType)) ?? null;

    if (!type) {
      return type;
    }

    if (originalParent instanceof ResolveValueWrapper) {
      const config = configStore.getTypeConfig(
        typeof type === 'string' ? type : type.name,
        'Object',
      );

      await originalParent.updateData(config);
    }

    return type;
  };
}
