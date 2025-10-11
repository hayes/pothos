import {
  type FieldKind,
  RootFieldBuilder,
  type SchemaTypes,
  type TypeParam,
  typeBrandKey,
  UnionRef,
} from '@pothos/core';
import {
  defaultTypeResolver,
  type GraphQLAbstractType,
  GraphQLObjectType,
  type GraphQLResolveInfo,
} from 'graphql';
import {
  defaultGetUnionName,
  errorTypeMap,
  sortedErrors,
  wrapErrorIfMatches,
  wrapOrThrow,
  yieldAsyncErrors,
  yieldErrors,
} from './utils';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

function createResolveType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  customResolveType:
    | ((parent: unknown, context: unknown, info: unknown, type: unknown) => unknown)
    | undefined,
) {
  return (
    parent: unknown,
    context: unknown,
    info: GraphQLResolveInfo,
    type: GraphQLAbstractType,
  ) => {
    if (typeof parent === 'object' && parent !== null) {
      const mappedType = errorTypeMap.get(parent as {});
      if (mappedType) {
        return builder.configStore.getTypeConfig(mappedType as never).name;
      }
    }
    // matches core resolveType logic
    if (typeof parent === 'object' && parent !== null && typeBrandKey in parent) {
      const typeBrand = (parent as { [typeBrandKey]: unknown })[typeBrandKey];

      if (typeof typeBrand === 'string') {
        return typeBrand;
      }

      return builder.configStore.getTypeConfig(typeBrand as never).name;
    }

    // Use custom resolveType if provided, otherwise fall back to default
    const resultOrPromise = customResolveType
      ? (customResolveType(parent, context, info, type) as
          | GraphQLObjectType<unknown, object>
          | string
          | null
          | undefined
          | Promise<GraphQLObjectType<unknown, object> | string | null | undefined>)
      : defaultTypeResolver(parent, context, info, type);

    const getResult = (result: GraphQLObjectType<unknown, object> | string | null | undefined) => {
      if (typeof result === 'string' || !result) {
        return result!;
      }

      if (result instanceof GraphQLObjectType) {
        return result.name;
      }

      try {
        return builder.configStore.getTypeConfig(result as never).name;
      } catch {
        // ignore
      }

      return result as string;
    };

    return resultOrPromise && typeof resultOrPromise === 'object' && 'then' in resultOrPromise
      ? (
          resultOrPromise as Promise<GraphQLObjectType<unknown, object> | string | null | undefined>
        ).then(getResult)
      : getResult(
          resultOrPromise as GraphQLObjectType<unknown, object> | string | null | undefined,
        );
  };
}

function createErrorUnion(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  unionRef: UnionRef<SchemaTypes, unknown>,
  types: TypeParam<SchemaTypes>[],
  unionOptions: Partial<PothosSchemaTypes.UnionTypeOptions<SchemaTypes>> & { name?: string },
  fieldConfig: { parentType: string; name: string },
) {
  const parentTypeName = builder.configStore.getTypeConfig(fieldConfig.parentType).name;
  const { name: getUnionName = defaultGetUnionName } =
    builder.options.errors?.defaultUnionOptions ?? {};

  const unionName =
    (unionOptions.name as string | undefined) ??
    getUnionName({ parentTypeName, fieldName: fieldConfig.name });

  const actualUnion = builder.unionType(unionName, {
    types: types as never,
    ...builder.options.errors?.defaultUnionOptions,
    ...unionOptions,
    resolveType: createResolveType(builder, unionOptions.resolveType as never),
  });

  builder.configStore.associateParamWithRef(unionRef, actualUnion);
}

fieldBuilderProto.errorUnionField = function errorUnionField({
  types,
  union: unionOptions = {} as never,
  resolve,
  ...fieldOptions
}) {
  const unionRef = new UnionRef('UnnamedErrorUnion');
  const allTypes = [
    ...types,
    ...(this.builder.options.errors?.defaultTypes ?? []),
  ] as TypeParam<SchemaTypes>[];
  const errorTypes = sortedErrors(allTypes);
  const onResolvedError = this.builder.options.errors?.onResolvedError;

  const wrappedResolve = resolve
    ? async (...args: unknown[]) => {
        try {
          const result = await (resolve as (...args: unknown[]) => unknown)(...args);
          return wrapErrorIfMatches(result, errorTypes, onResolvedError);
        } catch (error: unknown) {
          return wrapOrThrow(error, errorTypes, onResolvedError);
        }
      }
    : undefined;

  const fieldRef = this.field({
    ...fieldOptions,
    resolve: wrappedResolve,
    type: unionRef as never,
  } as never);

  fieldRef.onFirstUse((fieldConfig) => {
    createErrorUnion(this.builder, unionRef, allTypes, unionOptions, fieldConfig);
  });

  return fieldRef as never;
};

fieldBuilderProto.errorUnionListField = function errorUnionListField({
  types,
  union: unionOptions = {} as never,
  resolve,
  ...fieldOptions
}) {
  const unionRef = new UnionRef('UnnamedErrorUnion');
  const allTypes = [
    ...types,
    ...(this.builder.options.errors?.defaultTypes ?? []),
  ] as TypeParam<SchemaTypes>[];
  const errorTypes = sortedErrors(allTypes);
  const onResolvedError = this.builder.options.errors?.onResolvedError;

  const wrappedResolve = resolve
    ? async (...args: unknown[]) => {
        try {
          const result = await (resolve as (...args: unknown[]) => unknown)(...args);

          if (result && typeof result === 'object' && Symbol.iterator in result) {
            return yieldErrors(result as Iterable<unknown>, errorTypes, onResolvedError);
          }

          if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
            return yieldAsyncErrors(result as AsyncIterable<unknown>, errorTypes, onResolvedError);
          }

          return result;
        } catch (error: unknown) {
          return [wrapOrThrow(error, errorTypes, onResolvedError)];
        }
      }
    : undefined;

  const fieldRef = this.field({
    ...fieldOptions,
    resolve: wrappedResolve,
    type: [unionRef] as never,
  } as never);

  fieldRef.onFirstUse((fieldConfig) => {
    createErrorUnion(this.builder, unionRef, allTypes, unionOptions, fieldConfig);
  });

  return fieldRef as never;
};
