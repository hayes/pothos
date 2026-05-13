import { RootFieldBuilder, type SchemaTypes } from '@pothos/core';
import { PRISMA_NEXT_PREPARED } from './constants';
import type { PreparedFieldExtension } from './extensions';
import { PrismaNextObjectRef } from './object-ref';
import { assertNoVariantOnlyRegistration, getRefFromContractModel } from './utils/refs';

type TypeParam =
  | string
  | PrismaNextObjectRef<SchemaTypes, never, never>
  | [string]
  | [PrismaNextObjectRef<SchemaTypes, never, never>];

interface PrismaFieldInternalOptions {
  type: TypeParam;
  resolve: unknown;
  description?: string;
  args?: unknown;
  nullable?: boolean;
}

function resolveModelAndRef(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: TypeParam,
  callerLabel: string,
): { modelName: string; typeName: string; typeParam: unknown } {
  const isList = Array.isArray(type);
  const inner = (isList ? type[0] : type) as
    | string
    | PrismaNextObjectRef<SchemaTypes, never, never>;
  if (typeof inner === 'string') {
    assertNoVariantOnlyRegistration(inner, builder, callerLabel, 'object');
  }
  const ref =
    inner instanceof PrismaNextObjectRef ? inner : getRefFromContractModel(inner as never, builder);
  const modelName = ref.modelName as string;
  // typeName diverges from modelName on variant prismaObjects. The
  // plugin's wrapResolve brands rows with typeName so plugin-relay's
  // resolveType routes them correctly in Node positions.
  const typeName = (ref as { name?: string }).name ?? modelName;
  return { modelName, typeName, typeParam: isList ? [ref] : ref };
}

const rootFieldBuilderProto = RootFieldBuilder.prototype as unknown as Record<string, unknown>;

rootFieldBuilderProto.prismaField = function prismaField(
  this: {
    field: (cfg: unknown) => unknown;
    builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
  },
  options: PrismaFieldInternalOptions,
) {
  const { type, resolve, extensions, ...rest } = options as PrismaFieldInternalOptions & {
    extensions?: Record<string, unknown>;
  };
  const { modelName, typeName, typeParam } = resolveModelAndRef(
    this.builder,
    type,
    't.prismaField',
  );
  return this.field({
    ...rest,
    type: typeParam,
    resolve: resolve as never,
    extensions: {
      ...(extensions ?? {}),
      [PRISMA_NEXT_PREPARED]: { modelName, typeName } satisfies PreparedFieldExtension,
    },
  });
};

rootFieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: {
    fieldWithInput: (cfg: unknown) => unknown;
    builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
  },
  options: PrismaFieldInternalOptions,
) {
  const { type, resolve, extensions, ...rest } = options as PrismaFieldInternalOptions & {
    extensions?: Record<string, unknown>;
  };
  const { modelName, typeName, typeParam } = resolveModelAndRef(
    this.builder,
    type,
    't.prismaFieldWithInput',
  );
  return this.fieldWithInput({
    ...rest,
    type: typeParam,
    resolve: resolve as never,
    extensions: {
      ...(extensions ?? {}),
      [PRISMA_NEXT_PREPARED]: { modelName, typeName } satisfies PreparedFieldExtension,
    },
  });
};
