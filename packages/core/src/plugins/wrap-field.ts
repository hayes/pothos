import {
  defaultFieldResolver,
  GraphQLResolveInfo,
  GraphQLTypeResolver,
  GraphQLAbstractType,
} from 'graphql';
import { SchemaTypes, GiraphQLOutputFieldConfig, GiraphQLTypeConfig } from '..';
import { ResolveValueWrapper, ValueWrapper } from './resolve-wrapper';
import BaseFieldWrapper from './field-wrapper';
import ConfigStore from '../config-store';

function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('List resolvers must return arrays');
  }

  return true;
}

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
    const parentValue =
      originalParent instanceof ValueWrapper ? await originalParent.unwrap() : originalParent;
    const parentData = originalParent instanceof ValueWrapper ? await originalParent.getData() : {};

    const requestData = getRequestData(context, () => fieldWrapper.createRequestData(context));

    if (originalParent instanceof ValueWrapper && originalParent.hasFieldResult(info)) {
      if (await fieldWrapper.allowReuse(requestData, parentData, parentValue, args, config, info)) {
        return originalParent.getFieldResult(info);
      }
    }

    const resolveHooks = await fieldWrapper.beforeResolve(
      requestData,
      parentData,
      parentValue,
      args,
      context,
      info,
    );

    const result: unknown = resolveHooks.overwriteResolve
      ? await resolveHooks.overwriteResolve(parentValue, args, context, info, originalResolver)
      : await originalResolver(parentValue, args, context, info);

    await resolveHooks?.onResolve?.(result);

    const wrapChild = async (child: unknown, index: number | null) => {
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

        await wrapped.updateData(returnType);
      }

      return wrapped;
    };

    const wrapResult = (resultValue: unknown) => {
      if (resultValue === null || resultValue === undefined || isScalarResolver) {
        return resultValue;
      }

      if (isListResolver && assertArray(resultValue)) {
        const wrappedList = resultValue.map((item, i) =>
          Promise.resolve(item).then((value) => wrapChild(value, i)),
        );

        return wrappedList;
      }

      return wrapChild(resultValue, null);
    };

    const wrappedResult = await wrapResult(result);

    await resolveHooks?.onWrappedResolve?.(wrappedResult);

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

    const subscribeHook = await fieldWrapper.beforeSubscribe(
      requestData,
      originalParent,
      args,
      context,
      info,
    );

    const result: AsyncIterable<unknown> = await originalSubscribe!(
      originalParent,
      args,
      context,
      info,
    );

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
