import {
  type FieldKind,
  RootFieldBuilder,
  type SchemaTypes,
  type TypeParam,
  UnionRef,
} from '@pothos/core';
import {
  defaultGetListItemUnionName,
  defaultGetUnionName,
  extractAndSortErrorTypes,
} from './utils';

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

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

  builder.configStore.associateParamWithRef(
    unionRef,
    builder.errorUnion(unionName, {
      ...builderDefaultOptions,
      ...unionOptions,
      types: types as never,
    }),
  );
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
  const allTypes = [
    ...new Set([...types, ...(fieldBuilder.builder.options.errors?.defaultTypes ?? [])]),
  ] as TypeParam<SchemaTypes>[];
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
