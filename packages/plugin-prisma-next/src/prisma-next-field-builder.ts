import { RootFieldBuilder, type SchemaTypes } from '@pothos/core';
import { PRISMA_NEXT_PREPARED } from './constants.js';
import type { PreparedFieldExtension } from './extensions.js';
import { PrismaNextObjectRef } from './object-ref.js';
import { getRefFromContractModel } from './utils/refs.js';

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
): { modelName: string; typeName: string; typeParam: unknown } {
  const isList = Array.isArray(type);
  const inner = (isList ? type[0] : type) as
    | string
    | PrismaNextObjectRef<SchemaTypes, never, never>;
  const ref =
    inner instanceof PrismaNextObjectRef ? inner : getRefFromContractModel(inner as never, builder);
  const modelName = ref.modelName as string;
  // typeName diverges from modelName on variant prismaObjects. The
  // plugin records both on PRISMA_NEXT_PREPARED so wrapResolve can
  // descend into the right return-type config at request time.
  const typeName = (ref as { name?: string }).name ?? modelName;
  return { modelName, typeName, typeParam: isList ? [ref] : ref };
}

const rootFieldBuilderProto = RootFieldBuilder.prototype as unknown as Record<string, unknown>;

/** The field config `prismaField` and `prismaFieldWithInput` build; they differ only in target. */
function preparedFieldConfig(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  options: PrismaFieldInternalOptions,
) {
  const { type, resolve, extensions, ...rest } = options as PrismaFieldInternalOptions & {
    extensions?: Record<string, unknown>;
  };
  const { modelName, typeName, typeParam } = resolveModelAndRef(builder, type);

  return {
    ...rest,
    type: typeParam,
    resolve: resolve as never,
    extensions: {
      ...(extensions ?? {}),
      [PRISMA_NEXT_PREPARED]: {
        modelName,
        typeName,
        isList: Array.isArray(type),
      } satisfies PreparedFieldExtension,
    },
  };
}

rootFieldBuilderProto.prismaField = function prismaField(
  this: {
    field: (cfg: unknown) => unknown;
    builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
  },
  options: PrismaFieldInternalOptions,
) {
  return this.field(preparedFieldConfig(this.builder, options));
};

rootFieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: {
    fieldWithInput: (cfg: unknown) => unknown;
    builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
  },
  options: PrismaFieldInternalOptions,
) {
  return this.fieldWithInput(preparedFieldConfig(this.builder, options));
};
