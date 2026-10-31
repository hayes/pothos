import { PothosSchemaError, RootFieldBuilder, type SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { PrismaNextInterfaceRef } from './interface-ref.js';
import { PrismaNextObjectRef } from './object-ref.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import { assertVariantCollection } from './utils/contract.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getRefForContractModel } from './utils/refs.js';

type Ref =
  | PrismaNextObjectRef<SchemaTypes, never, never>
  | PrismaNextInterfaceRef<SchemaTypes, never, never>;

interface PrismaFieldOptions {
  type: string | Ref | [string | Ref];
  resolve: (...args: unknown[]) => unknown;
}

type Executable = MapperCollection & { all(): Promise<readonly unknown[]> };

function isCollection(value: unknown): value is Executable {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { include, all } = value as { include?: unknown; all?: unknown };
  return typeof include === 'function' && typeof all === 'function';
}

/**
 * A `prismaField`'s type with a model name resolved to its ref, and its resolver: the user's
 * Collection with the field's whole selection applied, then executed (one row for a singular
 * field).
 */
function prismaFieldConfig(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  { type, resolve, ...options }: PrismaFieldOptions,
) {
  const isList = Array.isArray(type);
  const inner = isList ? type[0] : type;
  const ref =
    inner instanceof PrismaNextObjectRef || inner instanceof PrismaNextInterfaceRef
      ? inner
      : getRefForContractModel(inner as never, builder);
  const modelName = ref.modelName as string;

  return {
    ...options,
    type: isList ? [ref] : ref,
    resolve: async (parent: unknown, args: unknown, context: object, info: GraphQLResolveInfo) => {
      const collection = await resolve(parent, args, context, info);
      if (collection == null) {
        return collection;
      }
      if (!isCollection(collection)) {
        throw new PothosSchemaError(
          `t.prismaField '${info.parentType.name}.${info.fieldName}' must return an ORM Collection or null. ` +
            'Return the collection before executing it so the complete GraphQL selection can be applied.',
        );
      }
      const config = getPluginConfig(builder);
      assertVariantCollection(config.contract, modelName, collection);
      const applied = (await applySelectionToCollection(
        collection,
        info,
        config,
        context,
      )) as Executable;
      const rows = await (isList ? applied : (applied.limit(1) as Executable)).all();
      return isList ? rows : (rows[0] ?? null);
    },
  };
}

const rootFieldBuilderProto = RootFieldBuilder.prototype as unknown as Record<string, unknown>;

rootFieldBuilderProto.prismaField = function prismaField(
  this: RootFieldBuilder<SchemaTypes, unknown>,
  options: PrismaFieldOptions,
) {
  return this.field(prismaFieldConfig(this.builder, options) as never);
};

rootFieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: RootFieldBuilder<SchemaTypes, unknown> & { fieldWithInput: (options: object) => unknown },
  options: PrismaFieldOptions,
) {
  return this.fieldWithInput(prismaFieldConfig(this.builder, options));
};
