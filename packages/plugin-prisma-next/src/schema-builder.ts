import SchemaBuilder, {
  PothosSchemaError,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
import {
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_TYPE_SELECT,
} from './constants.js';
import { PrismaNextInterfaceRef } from './interface-ref.js';
import { PrismaNextNodeRef } from './node-ref.js';
import { PrismaNextObjectRef } from './object-ref.js';
import { PrismaNextObjectFieldBuilder } from './prisma-next-field-builder.js';
import type { PrismaNextObjectOptions } from './types/fields.js';
import type { ModelKey } from './types/models.js';
import type { MapperCollection } from './utils/adapter.js';
import { getPluginConfig } from './utils/config.js';
import { modelDiscriminator, resolveContractModel } from './utils/contract.js';
import { InternalError, reloadFor } from './utils/errors.js';
import { getModelIdentities, truncatedDateProblem } from './utils/model.js';
import { encodeNodeId, parseNodeId } from './utils/node-ids.js';
import { getRefFromContractModel } from './utils/refs.js';
import { variantTypeNames } from './utils/variant-types.js';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

function withDiscriminatorSelected(select: unknown, field: string) {
  if (Array.isArray(select)) {
    return [...select, field];
  }
  return { ...(select as object | undefined), [field]: true };
}

function definePrismaNextType<Types extends SchemaTypes, M extends ModelKey<Types>>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelKey: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
  kind: 'Interface' | 'Object',
) {
  const { contract } = getPluginConfig(builder);
  const isInterface = kind === 'Interface';
  // Only a variant is a type of its own. Any other registration is the model's default type, which
  // `t.relation` and helpers given a model key resolve to, and `name` only renames it.
  const ref =
    options.variant === undefined
      ? getRefFromContractModel(modelKey as string, builder, kind)
      : isInterface
        ? new PrismaNextInterfaceRef<Types, M>(options.variant, modelKey)
        : new PrismaNextObjectRef<Types, M>(options.variant, modelKey);
  if (options.variant === undefined && builder.configStore.hasConfig(ref)) {
    throw new PothosSchemaError(
      `Model '${modelKey as string}' already has a type registered without a 'variant'. ` +
        "Give one of them a 'variant', or add fields with prismaObjectField(s).",
    );
  }
  ref.name = options.variant ?? options.name ?? ref.name;
  const typeName = ref.name;

  const discriminator = isInterface ? modelDiscriminator(contract, modelKey as string) : undefined;
  const select = discriminator
    ? withDiscriminatorSelected(options.select, discriminator.field)
    : options.select;
  // Without a custom `resolveType`, a row resolves to the type registered for its variant.
  const discriminated = !!discriminator && !(options as { resolveType?: unknown }).resolveType;
  const config = {
    ...(discriminated
      ? {
          resolveType: (
            row: Record<string, unknown>,
            _ctx: unknown,
            info: GraphQLResolveInfo,
            iface: GraphQLInterfaceType,
          ) => {
            const value = row[discriminator.field];
            const typeName = variantTypeNames(contract, info.schema, iface).get(value as string);
            // The row's value is left out of the message, which logs often capture.
            if (typeName === undefined) {
              throw new InternalError(
                value === undefined
                  ? `prismaInterface '${iface.name}' row was loaded without its discriminator '${discriminator.field}'. Return it from a prisma field, or include '${discriminator.field}' in the row.`
                  : `prismaInterface '${iface.name}' row has a discriminator '${discriminator.field}' that names no variant of model '${modelKey as string}'.`,
              );
            }
            return typeName;
          },
        }
      : {}),
    ...(options as object),
    extensions: {
      ...(options.extensions as Record<string, unknown> | undefined),
      ...(discriminated ? { [PRISMA_NEXT_DISCRIMINATED]: true } : {}),
      [PRISMA_NEXT_MODEL]: modelKey,
      ...(select !== undefined ? { [PRISMA_NEXT_TYPE_SELECT]: select } : {}),
    },
    name: typeName,
    fields: options.fields
      ? () =>
          options.fields!(
            new PrismaNextObjectFieldBuilder<Types, M>(
              builder,
              modelKey,
              contract as Types['PrismaNextContract'],
              kind,
            ) as never,
          )
      : undefined,
  } as never;

  if (isInterface) {
    builder.interfaceType(ref as never, config);
  } else {
    builder.objectType(ref as never, config);
  }

  return ref;
}

schemaBuilderProto.prismaObject = function prismaObject<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelKey: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  return definePrismaNextType<Types, M>(this, modelKey, options, 'Object') as never;
} as never;

schemaBuilderProto.prismaInterface = function prismaInterface<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelKey: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  return definePrismaNextType<Types, M>(this, modelKey, options, 'Interface') as never;
} as never;

/**
 * Adds fields for `prismaObjectField(s)` and `prismaInterfaceField(s)`. A model name refers to the
 * model's default type.
 */
function addPrismaNextFields(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type:
    | string
    | PrismaNextObjectRef<SchemaTypes, never, unknown>
    | PrismaNextInterfaceRef<SchemaTypes, never, unknown>,
  fields: (t: PrismaNextObjectFieldBuilder<SchemaTypes, never>) => object,
  kind: 'Interface' | 'Object',
) {
  const ref = typeof type === 'string' ? getRefFromContractModel(type, builder, kind) : type;
  const modelKey = ref.modelKey;
  const build = () =>
    fields(
      new PrismaNextObjectFieldBuilder(
        builder,
        modelKey as never,
        getPluginConfig(builder).contract,
        kind,
      ),
    );
  if (kind === 'Interface') {
    builder.interfaceFields(ref as never, build as never);
  } else {
    builder.objectFields(ref as never, build as never);
  }
}

schemaBuilderProto.prismaObjectField = function prismaObjectField(type, fieldName, field) {
  addPrismaNextFields(this, type as never, (t) => ({ [fieldName]: field(t as never) }), 'Object');
};

schemaBuilderProto.prismaInterfaceField = function prismaInterfaceField(type, fieldName, field) {
  addPrismaNextFields(
    this,
    type as never,
    (t) => ({ [fieldName]: field(t as never) }),
    'Interface',
  );
};

schemaBuilderProto.prismaObjectFields = function prismaObjectFields(type, fields) {
  addPrismaNextFields(this, type as never, fields as never, 'Object');
};

schemaBuilderProto.prismaInterfaceFields = function prismaInterfaceFields(type, fields) {
  addPrismaNextFields(this, type as never, fields as never, 'Interface');
};

schemaBuilderProto.prismaNode = function prismaNode<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types> & {
    nodeRef: (
      ref: unknown,
      options: {
        id: {
          parse: (id: string, ctx: Types['Context']) => unknown;
          resolve: (parent: unknown, args: object, ctx: Types['Context']) => unknown;
          extensions?: Record<string, unknown>;
        };
        loadWithoutCache: (
          id: unknown,
          ctx: Types['Context'],
          info: GraphQLResolveInfo,
        ) => Promise<unknown>;
      },
    ) => unknown;
  },
  modelKey: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]> & {
    id: {
      field: string | readonly string[];
      parse?: (id: string, ctx: Types['Context']) => unknown;
      resolve?: (parent: unknown, ctx: Types['Context']) => unknown;
      extensions?: Record<string, unknown>;
    };
    collection?: (ctx: Types['Context']) => MapperCollection;
  },
) {
  const { id: idOpts, collection, ...rest } = options;
  const {
    field: _field,
    parse: _parse,
    resolve: _resolve,
    extensions: idExtensions,
    ...idFieldOptions
  } = idOpts;
  const nodeModelKey = modelKey as string;
  const isTuple = Array.isArray(idOpts.field);
  const idFields = isTuple ? (idOpts.field as readonly string[]) : [idOpts.field as string];
  const config = getPluginConfig(this);
  const { contract } = config;
  const contractModel = resolveContractModel(contract, nodeModelKey)!;
  const identities = getModelIdentities(contract, nodeModelKey);
  // IDs must be unique and non-null to load back as the same row.
  if (
    identities &&
    !identities.some((identity) => identity.every((field) => idFields.includes(field)))
  ) {
    throw new PothosSchemaError(
      `prismaNode '${nodeModelKey}' id.field must include every field of a non-null primary or unique key.`,
    );
  }
  const nullableIdField = idFields.find((field) => contractModel.fields[field]?.nullable !== false);
  if (nullableIdField) {
    throw new PothosSchemaError(
      `prismaNode '${nodeModelKey}' id.field '${nullableIdField}' must be a non-null model field.`,
    );
  }
  const truncated = idFields
    .map((field) => truncatedDateProblem(contract, nodeModelKey, field))
    .find(Boolean);
  if (truncated) {
    throw new PothosSchemaError(
      `prismaNode '${nodeModelKey}' id.field can't load its row back: ${truncated}.`,
    );
  }

  const parseId =
    idOpts.parse ??
    ((id: string) => parseNodeId(idFields, id, config.codecs(nodeModelKey), { tuple: isTuple }));
  const objectRef = this.prismaObject(modelKey as never, rest as never);
  const typeName = objectRef.name;
  const nodeRef = new PrismaNextNodeRef<Types, M, unknown, unknown>(typeName, modelKey, {
    parseId,
  });
  this.configStore.associateParamWithRef(nodeRef as never, objectRef as never);

  this.nodeRef(objectRef as never, {
    id: {
      ...idFieldOptions,
      extensions: { ...idExtensions, [PRISMA_NEXT_FIELD_SELECTION]: { columns: idFields } },
      parse: parseId,
      resolve: (parent: unknown, _args: object, ctx: Types['Context']) => {
        if (idOpts.resolve) {
          return idOpts.resolve(parent, ctx);
        }
        const row = parent as Record<string, unknown>;
        if (idOpts.parse) {
          const values = idFields.map((field) => row[field]);
          return isTuple
            ? JSON.stringify(values, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value,
              )
            : String(values[0]);
        }
        return encodeNodeId(nodeModelKey, idFields, row, config.codecs(nodeModelKey));
      },
    },
    loadWithoutCache: (id: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
      // `id.parse` may build the tuple from the client's ID.
      if (isTuple && (!Array.isArray(id) || id.length !== idFields.length)) {
        throw new PothosValidationError('Invalid ID.');
      }
      return reloadFor(info, () =>
        config
          .loader(context, nodeModelKey)
          .loadNode(info, typeName, idFields, isTuple ? (id as unknown[]) : [id], collection),
      );
    },
  });

  return nodeRef as never;
} as never;
