import {
  defaultFieldResolver,
  GraphQLOutputType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLScalarType,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLResolveInfo,
} from 'graphql';
import { BasePlugin, BuildCache } from '..';

export class ResolveValueWrapper {
  parent: ResolveValueWrapper | null;

  value: unknown;

  data: Partial<GiraphQLSchemaTypes.ResolverPluginData> = {};

  constructor(value: unknown, parent: ResolveValueWrapper | null = null) {
    this.value = value;
    this.parent = parent;
  }

  unwrap() {
    return this.value;
  }

  static wrap(value: unknown, parent: ResolveValueWrapper | null = null) {
    if (value instanceof ResolveValueWrapper) {
      return value;
    }

    return new ResolveValueWrapper(value, parent);
  }

  child(value: unknown) {
    return new ResolveValueWrapper(value, this);
  }
}

export function isScalar(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLNonNull) {
    return isScalar(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return isScalar(type.ofType);
  }

  return type instanceof GraphQLScalarType || type instanceof GraphQLEnumType;
}

export function isList(type: GraphQLOutputType): boolean {
  if (type instanceof GraphQLNonNull) {
    return isList(type.ofType);
  }

  return type instanceof GraphQLList;
}

export function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('List resolvers must return arrays');
  }

  return true;
}

export function wrapResolver(
  name: string,
  config: GraphQLFieldConfig<unknown, object>,
  plugin: Required<BasePlugin>,
  cache: BuildCache,
) {
  const originalResolver = config.resolve || defaultFieldResolver;
  const originalSubscribe = config.subscribe;
  const partialFieldData: Partial<GiraphQLSchemaTypes.FieldWrapData> = {
    resolve: originalResolver,
  };

  const isListResolver = isList(config.type);
  const isScalarResolver = isScalar(config.type);

  // assume that onFieldWrap plugins added required props, if plugins fail to do this,
  // they are breaking the plugin contract.
  const fieldData = partialFieldData as GiraphQLSchemaTypes.FieldWrapData;

  const wrappedResolver = async (
    originalParent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const parent = ResolveValueWrapper.wrap(originalParent);

    const resolveHooks = await plugin.beforeResolve(parent, fieldData, args, context, info);

    const result = await fieldData.resolve(parent.value, args, context, info);

    async function wrapChild(child: unknown, index: number | null) {
      if (child == null) {
        return null;
      }

      const wrapped = parent.child(child);

      wrapped.data.parentFieldData = fieldData;

      await resolveHooks?.onWrap?.(
        wrapped,
        index,
        async (next: unknown) => (await wrapChild(child, index))!,
      );

      return wrapped;
    }

    await resolveHooks?.onResolve?.(result);

    if (result === null || result === undefined || isScalarResolver) {
      return result as unknown;
    }

    if (isListResolver && assertArray(result)) {
      return result.map((item, i) => Promise.resolve(item).then((value) => wrapChild(value, i)));
    }

    return wrapChild(result, null);
  };

  if (originalSubscribe) {
    const wrappedSubscribe = async (
      originalParent: unknown,
      args: {},
      context: object,
      info: GraphQLResolveInfo,
    ) => {
      const parent = ResolveValueWrapper.wrap(originalParent);

      const subscribeHook = await plugin.beforeSubscribe(parent, fieldData, args, context, info);

      const result: AsyncIterable<unknown> = await originalSubscribe(
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

              const wrapped = parent.child(value);

              await subscribeHook?.onWrap?.(wrapped);

              return { value: wrapped, done };
            },
            return: iter.return?.bind(iter),
            throw: iter.throw?.bind(iter),
          };
        },
      };
    };

    config.subscribe = wrappedSubscribe; // eslint-disable-line no-param-reassign
  }

  wrappedResolver.unwrap = () => originalResolver;

  config.resolve = wrappedResolver; // eslint-disable-line no-param-reassign

  plugin.onFieldWrap(name, config, partialFieldData, cache);
}
