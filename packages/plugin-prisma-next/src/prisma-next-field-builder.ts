import {
  type FieldKind,
  PothosSchemaError,
  PothosValidationError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { PrismaNextInterfaceRef } from './interface-ref.js';
import type { PrismaNextObjectRef } from './object-ref.js';
import type { MapperCollection } from './utils/adapter.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import { assertVariantCollection } from './utils/contract.js';
import { applySelectionToCollection } from './utils/map-query.js';
import { getModel } from './utils/model.js';
import { refFor } from './utils/refs.js';
import { materializeRows } from './utils/selections.js';

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
 * Builds the config of a `prismaField`. A model name in `type` resolves to its ref. The resolver
 * applies the field's whole selection to the returned Collection and executes it, reading one row
 * for a singular field.
 */
function prismaFieldConfig(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  { type, resolve, ...options }: PrismaFieldOptions,
) {
  const isList = Array.isArray(type);
  const inner = isList ? type[0] : type;
  const ref = refFor(builder, inner);
  const modelName = ref.modelName as string;

  return {
    ...options,
    type: isList ? [ref] : ref,
    resolve: async (parent: unknown, args: unknown, context: object, info: GraphQLResolveInfo) => {
      assertContextObject(context, info);
      const collection = await resolve(parent, args, context, info);
      if (collection == null) {
        return collection;
      }
      if (!isCollection(collection)) {
        throw new PothosValidationError(
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
      const rows = materializeRows(
        await (isList ? applied : (applied.limit(1) as Executable)).all(),
        getModel(config.contract, modelName),
      );
      return isList ? rows : (rows[0] ?? null);
    },
  };
}

const rootFieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

rootFieldBuilderProto.prismaField = function prismaField(options) {
  return this.field(prismaFieldConfig(this.builder, options as PrismaFieldOptions) as never);
};

rootFieldBuilderProto.prismaFieldWithInput = function prismaFieldWithInput(
  this: typeof rootFieldBuilderProto,
  options: PrismaFieldOptions,
) {
  if (typeof (this as { fieldWithInput?: unknown }).fieldWithInput !== 'function') {
    throw new PothosSchemaError(
      't.prismaFieldWithInput requires @pothos/plugin-with-input to be loaded.',
    );
  }
  return (
    this as typeof rootFieldBuilderProto & { fieldWithInput: (options: object) => unknown }
  ).fieldWithInput(prismaFieldConfig(this.builder, options)) as never;
} as never;
