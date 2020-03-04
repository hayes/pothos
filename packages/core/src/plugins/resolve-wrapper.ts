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
import { BasePlugin, BuildCache, Field } from '..';
import { TypeParam } from '../types';

export class ResolveValueWrapper {
  fieldName: string;

  value: unknown;

  data: Partial<GiraphQLSchemaTypes.ResolverPluginData> = {};

  constructor(fieldName: string, value: unknown) {
    this.fieldName = fieldName;
    this.value = value;
  }

  unwrap() {
    return this.value;
  }

  static wrap(fieldName: string, value: unknown) {
    if (value instanceof ResolveValueWrapper) {
      return value;
    }

    return new ResolveValueWrapper(fieldName, value);
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
  field: Field<{}, any, TypeParam<any>>,
  config: GraphQLFieldConfig<unknown, object>,
  plugin: Required<BasePlugin>,
  cache: BuildCache,
) {
  const originalResolver = config.resolve || defaultFieldResolver;
  const partialFieldData: Partial<GiraphQLSchemaTypes.FieldWrapData> = {};

  const isListResolver = isList(config.type);
  const isScalarResolver = isScalar(config.type);
  const fieldName = `${field.parentTypename}.${name}`;

  // assume that onFieldWrap plugins added required props, if plugins fail to do this,
  // they are breaking the plugin contract.
  const fieldData = partialFieldData as GiraphQLSchemaTypes.FieldWrapData;

  const wrappedResolver = async (
    originalParent: unknown,
    args: {},
    context: object,
    info: GraphQLResolveInfo,
  ) => {
    const parent = ResolveValueWrapper.wrap(fieldName, originalParent);

    const resolveHooks = await plugin.beforeResolve(parent, fieldData, args, context, info);

    const result = await originalResolver(parent.value, args, context, info);

    await resolveHooks?.onResolve?.(result);

    if (result === null || result === undefined || isScalarResolver) {
      return result;
    }

    if (isListResolver && assertArray(result)) {
      const wrappedResults: unknown[] = [];

      for (const item of result) {
        if (item instanceof Promise) {
          item.then(async resolved => {
            const wrapped = ResolveValueWrapper.wrap(fieldName, resolved);

            await resolveHooks?.onWrap?.(wrapped);

            wrappedResults.push(wrapped);
          });
        } else {
          const wrapped = ResolveValueWrapper.wrap(fieldName, item);
          // eslint-disable-next-line no-await-in-loop
          await resolveHooks?.onWrap?.(wrapped);

          wrappedResults.push(wrapped);
        }
      }

      return wrappedResults;
    }

    const wrapped = ResolveValueWrapper.wrap(fieldName, result);

    await resolveHooks?.onWrap?.(wrapped);

    return wrapped;
  };

  wrappedResolver.unwrap = () => originalResolver;

  config.resolve = wrappedResolver; // eslint-disable-line no-param-reassign

  plugin.onFieldWrap(name, field, config, partialFieldData, cache);
}
