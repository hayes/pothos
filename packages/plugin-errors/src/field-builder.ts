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
  defaultGetListItemUnionName,
  defaultGetUnionName,
  errorTypeMap,
  extractAndSortErrorTypes,
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

    const resultOrPromise = customResolveType
      ? customResolveType(parent, context, info, type)
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
  defaultNameGetter: (args: { parentTypeName: string; fieldName: string }) => string,
  isListField: boolean,
) {
  const parentTypeName = builder.configStore.getTypeConfig(fieldConfig.parentType).name;
  const builderDefaultOptions = isListField
    ? builder.options.errors?.defaultItemUnionOptions
    : builder.options.errors?.defaultUnionOptions;
  const { name: getUnionName = defaultNameGetter } = builderDefaultOptions ?? {};

  const unionName =
    (unionOptions.name as string | undefined) ??
    getUnionName({ parentTypeName, fieldName: fieldConfig.name });

  const actualUnion = builder.unionType(unionName, {
    types: types as never,
    ...builderDefaultOptions,
    ...unionOptions,
    resolveType: createResolveType(builder, unionOptions.resolveType as never),
  });

  builder.configStore.associateParamWithRef(unionRef, actualUnion);
}

function createErrorUnionFieldBase(
  fieldBuilder: PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>,
  fieldOptions: {
    types: TypeParam<SchemaTypes>[];
    union?: Partial<PothosSchemaTypes.UnionTypeOptions<SchemaTypes>> & { name?: string };
    [key: string]: unknown;
  },
  isListField: boolean,
) {
  const { types, union: unionOptions = {} as never, ...restOptions } = fieldOptions;
  const unionRef = new UnionRef('UnnamedErrorUnion');
  const allTypes = [...new Set([
    ...types,
    ...(fieldBuilder.builder.options.errors?.defaultTypes ?? []),
  ])] as TypeParam<SchemaTypes>[];
  const errorTypes = extractAndSortErrorTypes(allTypes);

  const fieldRef = fieldBuilder.field({
    ...restOptions,
    type: (isListField ? [unionRef] : unionRef) as never,
    extensions: {
      ...(restOptions.extensions as object),
      ...(isListField ? { pothosItemErrors: errorTypes } : { pothosErrors: errorTypes }),
    },
  } as never);

  fieldRef.onFirstUse((fieldConfig) => {
    createErrorUnion(
      fieldBuilder.builder,
      unionRef,
      allTypes,
      unionOptions,
      fieldConfig,
      isListField ? defaultGetListItemUnionName : defaultGetUnionName,
      isListField,
    );
  });

  return fieldRef as never;
}

fieldBuilderProto.errorUnionField = function errorUnionField(options) {
  return createErrorUnionFieldBase(this, options, false);
};

fieldBuilderProto.errorUnionListField = function errorUnionListField(options) {
  return createErrorUnionFieldBase(this, options, true);
};
