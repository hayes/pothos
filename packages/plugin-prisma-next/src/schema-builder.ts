import SchemaBuilder, {
  PothosSchemaError,
  PothosValidationError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLInterfaceType, GraphQLResolveInfo } from 'graphql';
import {
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_SELECT,
} from './constants.js';
import { PrismaNextInterfaceRef } from './interface-ref.js';
import { PrismaNextNodeRef } from './node-ref.js';
import { PrismaNextObjectRef } from './object-ref.js';
import { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
// Installs the root field methods, which `claimPrismaMethods` below must see.
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import type { ModelName, PrismaNextObjectOptions } from './types.js';
import type { MapperCollection } from './utils/adapter.js';
import { claimPrismaMethods } from './utils/claim-methods.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import {
  assertContractModel,
  assertVariantCollection,
  defaultTypeName,
  modelDiscriminator,
  resolveContractModel,
  rootModelKey,
} from './utils/contract.js';
import { encodeNodeId, parseNodeId } from './utils/cursors.js';
import { getModelUniqueKeys } from './utils/model.js';
import { getRefFromContractModel } from './utils/refs.js';
import { variantTypeNames } from './utils/variant-types.js';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

function withDiscriminatorSelected(select: unknown, field: string) {
  return Array.isArray(select)
    ? [...select, field]
    : { ...(select as object | undefined), [field]: true };
}

function definePrismaNextType<Types extends SchemaTypes, M extends ModelName<Types>>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
  kind: 'interface' | 'object',
) {
  const isInterface = kind === 'interface';
  // A non-default name registers a variant type and gets its own ref; the default reuses the
  // cached ref that `t.relation` and string-form helpers resolve to.
  const defaultName = defaultTypeName(modelName as string);
  const typeName = options.variant ?? options.name ?? defaultName;
  const isVariant = typeName !== defaultName;
  const ref = isVariant
    ? isInterface
      ? new PrismaNextInterfaceRef<Types, M>(typeName, modelName)
      : new PrismaNextObjectRef<Types, M>(typeName, modelName)
    : getRefFromContractModel<Types, M>(modelName, builder, kind);

  const { contract } = getPluginConfig(builder);
  const discriminator = isInterface ? modelDiscriminator(contract, modelName as string) : undefined;
  const select = discriminator
    ? withDiscriminatorSelected(options.select, discriminator.field)
    : options.select;
  // Resolves to the type registered for the variant the discriminator names.
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
            if (typeName === undefined) {
              throw new PothosValidationError(
                value === undefined
                  ? `prismaInterface '${iface.name}' row was loaded without its discriminator '${discriminator.field}'. Return it from a prisma field, or include '${discriminator.field}' in the row.`
                  : `prismaInterface '${iface.name}' row has discriminator ${discriminator.field}=${JSON.stringify(value)}, which names no variant of model '${modelName as string}'.`,
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
      [PRISMA_NEXT_MODEL]: modelName,
      ...(select !== undefined ? { [PRISMA_NEXT_SELECT]: select } : {}),
    },
    name: typeName,
    fields: options.fields
      ? () =>
          options.fields!(
            new PrismaNextObjectFieldBuilder<Types, M>(
              builder,
              modelName,
              contract as Types['PrismaNextContract'],
              isInterface ? 'Interface' : 'Object',
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
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  return definePrismaNextType(this, modelName, options, 'object') as never;
} as never;

schemaBuilderProto.prismaInterface = function prismaInterface<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  return definePrismaNextType(this, modelName, options, 'interface') as never;
} as never;

/**
 * The body of `prismaObjectField(s)` and `prismaInterfaceField(s)`: they differ only in kind. A
 * model name names the default type registered under it.
 */
function addPrismaNextFields(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: string | PrismaNextObjectRef<SchemaTypes, never, unknown>,
  fields: (t: PrismaNextObjectFieldBuilder<SchemaTypes, never>) => object,
  kind: 'Interface' | 'Object',
) {
  const modelName = typeof type === 'string' ? type : (type.modelName as string);
  const ref =
    typeof type !== 'string'
      ? type
      : getRefFromContractModel(
          modelName as never,
          builder,
          kind === 'Interface' ? 'interface' : undefined,
        );
  const build = () =>
    fields(
      new PrismaNextObjectFieldBuilder(
        builder,
        modelName as never,
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
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types> & {
    nodeRef?: (
      ref: unknown,
      options: {
        id: {
          parse: (id: string, ctx: Types['Context']) => unknown;
          resolve: (parent: unknown, args: object, ctx: Types['Context']) => unknown;
          description?: string;
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
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]> & {
    id: {
      field: string | readonly string[];
      description?: string;
      parse?: (id: string, ctx: Types['Context']) => unknown;
      resolve?: (parent: unknown, ctx: Types['Context']) => string | number;
    };
    collection?: unknown | ((ctx: Types['Context']) => unknown);
  },
) {
  if (typeof this.nodeRef !== 'function') {
    throw new PothosSchemaError('builder.prismaNode requires @pothos/plugin-relay to be loaded.');
  }

  const { id: idOpts, collection: collectionOpt, ...rest } = options;
  const nodeModelName = modelName as string;
  const idFields: readonly string[] = Array.isArray(idOpts.field)
    ? idOpts.field
    : [idOpts.field as string];
  const isComposite = idFields.length > 1;
  const config = getPluginConfig(this);
  const { contract } = config;
  assertContractModel(contract, nodeModelName);
  const identityKeys = getModelUniqueKeys(contract, nodeModelName);
  // IDs must be unique and non-null to load back as the same row.
  if (
    idFields.length === 0 ||
    (identityKeys && !identityKeys.some((key) => key.every((field) => idFields.includes(field))))
  ) {
    throw new PothosSchemaError(
      `prismaNode '${nodeModelName}' id.field must include every field of a non-null primary or unique key.`,
    );
  }
  const nullableIdField = idFields.find(
    (field) => resolveContractModel(contract, nodeModelName)?.fields[field]?.nullable !== false,
  );
  if (nullableIdField) {
    throw new PothosSchemaError(
      `prismaNode '${nodeModelName}' id.field '${nullableIdField}' must be a non-null model field.`,
    );
  }

  const collection =
    collectionOpt == null
      ? undefined
      : typeof collectionOpt === 'function'
        ? (collectionOpt as (ctx: Types['Context']) => MapperCollection)
        : () => collectionOpt as MapperCollection;
  const parseId =
    idOpts.parse ??
    ((id: string, ctx: Types['Context']) => {
      assertContextObject(ctx);
      return parseNodeId(nodeModelName, idFields, id, config.codecs(ctx, nodeModelName));
    });
  const objectRef = this.prismaObject(modelName as never, rest as never);
  const typeName = objectRef.name;
  const nodeRef = new PrismaNextNodeRef<Types, M, unknown, unknown>(typeName, modelName, {
    parseId,
  });
  this.configStore.associateParamWithRef(nodeRef as never, objectRef as never);

  this.nodeRef(objectRef as never, {
    id: {
      extensions: { [PRISMA_NEXT_FIELD_SELECT]: { columns: idFields } },
      ...(idOpts.description !== undefined ? { description: idOpts.description } : {}),
      parse: parseId,
      resolve: (
        parent: unknown,
        _args: object,
        ctx: Types['Context'],
        info?: GraphQLResolveInfo,
      ) => {
        if (idOpts.resolve) {
          return idOpts.resolve(parent, ctx);
        }
        const row = parent as Record<string, unknown>;
        if (idOpts.parse) {
          const values = idFields.map((field) => row[field]);
          return isComposite
            ? JSON.stringify(values, (_key, value) =>
                typeof value === 'bigint' ? value.toString() : value,
              )
            : String(values[0]);
        }
        assertContextObject(ctx, info);
        return encodeNodeId(nodeModelName, idFields, row, config.codecs(ctx, nodeModelName));
      },
    },
    loadWithoutCache: (id: unknown, context: Types['Context'], info: GraphQLResolveInfo) => {
      if (isComposite && (!Array.isArray(id) || id.length !== idFields.length)) {
        throw new PothosValidationError(
          `prismaNode '${nodeModelName}' composite ID expected ${idFields.length} values, got ${Array.isArray(id) ? id.length : 'a non-array value'}.`,
        );
      }
      return config.loader(context, nodeModelName).loadNode(
        info,
        typeName,
        idFields,
        isComposite ? (id as unknown[]) : [id],
        collection &&
          (() => {
            const found = collection(context);
            // The loader narrows a root collection to the node's variant itself.
            assertVariantCollection(
              contract,
              rootModelKey(contract, nodeModelName),
              found as never,
            );
            return found;
          }),
      );
    },
  });

  return nodeRef as never;
} as never;

claimPrismaMethods(schemaBuilderProto, [
  'prismaObject',
  'prismaInterface',
  'prismaObjectField',
  'prismaObjectFields',
  'prismaInterfaceField',
  'prismaInterfaceFields',
  'prismaNode',
]);
claimPrismaMethods(RootFieldBuilder.prototype, [
  'prismaField',
  'prismaFieldWithInput',
  'prismaConnection',
]);
