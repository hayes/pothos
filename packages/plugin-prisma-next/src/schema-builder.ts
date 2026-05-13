import SchemaBuilder, {
  brandWithType,
  type InterfaceRef,
  type OutputType,
  PothosSchemaError,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { and, or } from '@prisma-next/sql-orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_SELECT } from './constants';
import type { PrismaNextInterfaceRef } from './interface-ref';
import { PrismaNextNodeRef } from './node-ref';
import type { PrismaNextObjectRef } from './object-ref';
import { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder';
import type { ModelName, PrismaNextObjectOptions } from './types';
import { createApply } from './utils/apply';
import { CURSOR_PAYLOAD_MAX_BYTES } from './utils/cursors';
import { enqueueNodeLoad, pathKey } from './utils/node-batch';
import { mapperOptionsFromPluginOpts, readPluginOptions } from './utils/options';
import {
  assertNoVariantOnlyRegistration,
  findOrphanedDefaultRef,
  getInterfaceRefFromContractModel,
  getRefFromContractModel,
  markRefRegistered,
} from './utils/refs';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.prismaObject = function prismaObject<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  // `variant` wins over legacy `name`; both claim a variant identity
  // (a second prismaObject for the same model under a different GraphQL
  // type name).
  const variantName = (options as { variant?: string }).variant;
  const typeName = variantName ?? options.name ?? (modelName as string);
  const isVariant =
    variantName !== undefined ||
    (options.name !== undefined && options.name !== (modelName as string));
  if (isVariant) {
    // Catch forward-order footgun: prismaObjectField('User', …) ran
    // earlier and created an unregistered default-keyed ref; this
    // variant registration would key elsewhere and silently drop those
    // fields.
    const orphaned = findOrphanedDefaultRef(modelName as string, this, 'object');
    if (orphaned) {
      throw new PothosSchemaError(
        `builder.prismaObject('${modelName as string}', { name/variant: '${typeName}' }): ` +
          `prismaObjectField('${orphaned}', …) was called earlier with the contract model name, ` +
          'which created a lazy default-keyed ref that is never registered (you only register ' +
          `the variant '${typeName}'). Either pass the variant name to the field helper, or ` +
          'register the default object first via builder.prismaObject() without a variant.',
      );
    }
  }
  const ref = isVariant
    ? getRefFromContractModel<Types, M>(modelName, this, typeName)
    : getRefFromContractModel<Types, M>(modelName, this);
  markRefRegistered(this, 'object', typeName);
  const contract = readPluginOptions<Types['PrismaNextContract']>(this)?.contract;

  this.objectType(ref, {
    ...(options as object),
    extensions: {
      ...(options.extensions as Record<string, unknown> | undefined),
      [PRISMA_NEXT_MODEL]: modelName,
      ...(options.select !== undefined ? { [PRISMA_NEXT_SELECT]: options.select } : {}),
    },
    name: typeName,
    fields: options.fields
      ? () => {
          if (!contract) {
            throw new PothosSchemaError(
              `builder.prismaObject('${modelName as string}', ...) requires builder.options.prismaNext.contract to be set.`,
            );
          }
          const fieldBuilder = new PrismaNextObjectFieldBuilder<Types, M>(
            this as PothosSchemaTypes.SchemaBuilder<Types>,
            modelName,
            contract,
          );
          return options.fields!(fieldBuilder as never);
        }
      : undefined,
  } as never);

  return ref as never;
} as never;

schemaBuilderProto.prismaInterface = function prismaInterface<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
) {
  const variantName = (options as { variant?: string }).variant;
  const typeName = variantName ?? options.name ?? (modelName as string);
  const isVariant = typeName !== (modelName as string);
  if (isVariant) {
    const orphaned = findOrphanedDefaultRef(modelName as string, this, 'interface');
    if (orphaned) {
      throw new PothosSchemaError(
        `builder.prismaInterface('${modelName as string}', { name/variant: '${typeName}' }): ` +
          `prismaInterfaceField('${orphaned}', …) was called earlier with the contract model name, ` +
          'which created a lazy default-keyed ref that is never registered (you only register ' +
          `the variant '${typeName}'). Either pass the variant name to the field helper, or ` +
          'register the default interface first via builder.prismaInterface() without a variant.',
      );
    }
  }
  // Cache via `getInterfaceRefFromContractModel` so the string-form
  // helpers resolve to the SAME ref instance — otherwise their
  // `addFields` calls don't merge into this registration.
  const ref = getInterfaceRefFromContractModel<Types, M>(
    modelName,
    this,
    isVariant ? typeName : undefined,
  );
  markRefRegistered(this, 'interface', typeName);
  const contract = readPluginOptions<Types['PrismaNextContract']>(this)?.contract;

  this.interfaceType(
    ref as never,
    {
      ...(options as object),
      extensions: {
        ...(options.extensions as Record<string, unknown> | undefined),
        [PRISMA_NEXT_MODEL]: modelName,
        ...(options.select !== undefined ? { [PRISMA_NEXT_SELECT]: options.select } : {}),
      },
      name: typeName,
      fields: options.fields
        ? () => {
            if (!contract) {
              throw new PothosSchemaError(
                `builder.prismaInterface('${modelName as string}', ...) requires builder.options.prismaNext.contract to be set.`,
              );
            }
            const fieldBuilder = new PrismaNextObjectFieldBuilder<Types, M>(
              this as PothosSchemaTypes.SchemaBuilder<Types>,
              modelName,
              contract,
            );
            return options.fields!(fieldBuilder as never);
          }
        : undefined,
    } as never,
  );

  return ref as never;
} as never;

function resolveModelName<Types extends SchemaTypes, M extends ModelName<Types>>(
  type: M | { modelName: M },
): M {
  return typeof type === 'string' ? type : type.modelName;
}

function makeFieldBuilder<Types extends SchemaTypes, M extends ModelName<Types>>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
): PrismaNextObjectFieldBuilder<Types, M> {
  const contract = readPluginOptions<Types['PrismaNextContract']>(builder)?.contract;
  if (!contract) {
    throw new PothosSchemaError(
      'cross-file field helpers require builder.options.prismaNext.contract.',
    );
  }
  return new PrismaNextObjectFieldBuilder<Types, M>(builder, modelName, contract);
}

schemaBuilderProto.prismaObjectField = function prismaObjectField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextObjectRef<Types, M, unknown>,
  fieldName: string,
  field: (
    t: PrismaNextObjectFieldBuilder<Types, M>,
  ) => import('@pothos/core').FieldRef<Types, unknown>,
) {
  const modelName = resolveModelName(type as never) as M;
  if (typeof type === 'string') {
    assertNoVariantOnlyRegistration(modelName as string, this, 'prismaObjectField', 'object');
  }
  const ref = getRefFromContractModel<Types, M>(modelName, this);
  this.objectField(
    ref as never,
    fieldName,
    () => field(makeFieldBuilder(this, modelName)) as never,
  );
} as never;

schemaBuilderProto.prismaObjectFields = function prismaObjectFields<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextObjectRef<Types, M, unknown>,
  fields: (t: PrismaNextObjectFieldBuilder<Types, M>) => import('@pothos/core').FieldMap,
) {
  const modelName = resolveModelName(type as never) as M;
  if (typeof type === 'string') {
    assertNoVariantOnlyRegistration(modelName as string, this, 'prismaObjectFields', 'object');
  }
  const ref = getRefFromContractModel<Types, M>(modelName, this);
  this.objectFields(ref as never, () => fields(makeFieldBuilder(this, modelName)) as never);
} as never;

schemaBuilderProto.prismaInterfaceField = function prismaInterfaceField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextInterfaceRef<Types, M, unknown>,
  fieldName: string,
  field: (
    t: PrismaNextObjectFieldBuilder<Types, M>,
  ) => import('@pothos/core').FieldRef<Types, unknown>,
) {
  const modelName = resolveModelName(type as never) as M;
  if (typeof type === 'string') {
    assertNoVariantOnlyRegistration(modelName as string, this, 'prismaInterfaceField', 'interface');
  }
  const ref =
    typeof type === 'string' ? getInterfaceRefFromContractModel<Types, M>(type as M, this) : type;
  this.interfaceField(
    ref as never,
    fieldName,
    () => field(makeFieldBuilder(this, modelName)) as never,
  );
} as never;

schemaBuilderProto.prismaInterfaceFields = function prismaInterfaceFields<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextInterfaceRef<Types, M, unknown>,
  fields: (t: PrismaNextObjectFieldBuilder<Types, M>) => import('@pothos/core').FieldMap,
) {
  const modelName = resolveModelName(type as never) as M;
  if (typeof type === 'string') {
    assertNoVariantOnlyRegistration(
      modelName as string,
      this,
      'prismaInterfaceFields',
      'interface',
    );
  }
  const ref =
    typeof type === 'string' ? getInterfaceRefFromContractModel<Types, M>(type as M, this) : type;
  this.interfaceFields(ref as never, () => fields(makeFieldBuilder(this, modelName)) as never);
} as never;

schemaBuilderProto.prismaNode = function prismaNode<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
  IDShape = string,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types> & {
    nodeInterfaceRef?: () => InterfaceRef<Types, unknown>;
    nodeRef?: (
      ref: unknown,
      options: {
        id: {
          parse?: (id: string, ctx: Types['Context']) => IDShape;
          resolve: (parent: unknown, args: object, ctx: Types['Context']) => unknown;
          description?: string;
        };
        loadWithoutCache: (
          id: IDShape,
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
      parse?: (id: string, ctx: Types['Context']) => IDShape;
      resolve?: (parent: unknown, ctx: Types['Context']) => string | number;
    };
    collection: unknown | ((ctx: Types['Context']) => unknown);
  },
) {
  if (typeof this.nodeRef !== 'function') {
    throw new PothosSchemaError('builder.prismaNode requires @pothos/plugin-relay to be loaded.');
  }

  const { id: idOpts, collection: collectionOpt, ...rest } = options;
  if (collectionOpt == null) {
    throw new PothosSchemaError(
      `prismaNode('${modelName as string}') requires a \`collection\` option. ` +
        'Pass either a static Collection (`collection: db.User`) or a callback (`collection: (ctx) => db.User.where(...)`).',
    );
  }
  // Normalize to `(ctx) => Collection`. Safe heuristic: prisma-next's
  // Collection is a class instance, not a callable, so `typeof === 'function'`
  // unambiguously means the callback form.
  const collection =
    typeof collectionOpt === 'function'
      ? (collectionOpt as (ctx: Types['Context']) => unknown)
      : () => collectionOpt;
  const idFields: readonly string[] = Array.isArray(idOpts.field)
    ? idOpts.field
    : [idOpts.field as string];
  if (idFields.length === 0) {
    throw new PothosSchemaError(
      `prismaNode('${modelName as string}') id.field cannot be empty — pass a single column name or a non-empty array.`,
    );
  }
  const isComposite = idFields.length > 1;

  // Brand rows with the registered GraphQL type name (which diverges
  // from modelName for variants). Same-value `defineProperty` is OK;
  // different-value would clash with plugin-relay's later brand call.
  const variantName = (rest as { variant?: string; name?: string }).variant;
  const typeName = variantName ?? (rest as { name?: string }).name ?? (modelName as string);

  const nodeRef = new PrismaNextNodeRef<Types, M, unknown, IDShape>(typeName, modelName, {
    ...(idOpts.parse ? { parseId: idOpts.parse } : {}),
  });

  const pluginOpts = readPluginOptions<Types['PrismaNextContract']>(this);

  // User `isTypeOf` runs first (handles polymorphic discriminators);
  // brand check is the fallback. `isTypeOf` may return Promise<boolean>
  // — `userResult || brandCheck` would short-circuit on a truthy
  // Promise<false>, so branch on the return type and chain via .then.
  type IsTypeOfFn = (value: unknown, context: unknown, info: unknown) => boolean | Promise<boolean>;
  const userIsTypeOf = (rest as { isTypeOf?: IsTypeOfFn }).isTypeOf;
  const brandCheck = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && nodeRef.hasBrand(value);
  const objectRef = this.prismaObject(
    modelName as never,
    {
      ...(rest as object),
      isTypeOf: userIsTypeOf
        ? (value: unknown, context: unknown, info: unknown) => {
            const userResult = userIsTypeOf(value, context, info);
            if (
              userResult !== null &&
              typeof userResult === 'object' &&
              'then' in userResult &&
              typeof (userResult as Promise<boolean>).then === 'function'
            ) {
              return (userResult as Promise<boolean>).then((r) => r || brandCheck(value));
            }
            return userResult || brandCheck(value);
          }
        : brandCheck,
    } as never,
  );

  this.configStore.associateParamWithRef(nodeRef as never, objectRef as never);

  // Single-column ids return the raw value; composite ids JSON-encode
  // the tuple (matches drizzle's getIDSerializer for cross-plugin parity).
  const serializeId = (parent: unknown): string | number => {
    const row = parent as Record<string, unknown>;
    if (!isComposite) {
      const v = row[idFields[0]!];
      return v as string | number;
    }
    return JSON.stringify(idFields.map((f) => row[f]));
  };

  if (!pluginOpts) {
    throw new PothosSchemaError('prismaNode requires builder.options.prismaNext to be set.');
  }
  const nodeMapperOpts = mapperOptionsFromPluginOpts(pluginOpts);
  const nodeModelName = modelName as string;
  const contract = pluginOpts.contract;

  // Without a user `id.parse`, composite ids arrive as the serialized
  // JSON string — decode with a length cap to deny oversized DoS.
  // Validation errors map to PothosValidationError (client) rather than
  // PothosSchemaError (server config).
  const normalizeId = (id: IDShape): IDShape => {
    if (!isComposite) {
      return id;
    }
    if (Array.isArray(id)) {
      return id as IDShape;
    }
    const raw = id as unknown as string;
    if (typeof raw === 'string' && raw.length > CURSOR_PAYLOAD_MAX_BYTES) {
      throw new PothosValidationError(
        `prismaNode '${nodeModelName}' composite ID payload exceeds ${CURSOR_PAYLOAD_MAX_BYTES} bytes.`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      throw new PothosValidationError(
        `prismaNode '${nodeModelName}' composite ID is not a valid JSON array.`,
      );
    }
    if (!Array.isArray(parsed)) {
      const got = parsed === null ? 'null' : typeof parsed;
      throw new PothosValidationError(
        `prismaNode '${nodeModelName}' composite ID expected a JSON array, got ${got}.`,
      );
    }
    if (parsed.length !== idFields.length) {
      throw new PothosValidationError(
        `prismaNode '${nodeModelName}' composite ID expected ${idFields.length} values, got ${parsed.length}.`,
      );
    }
    return parsed as IDShape;
  };

  this.nodeRef(objectRef as never, {
    id: {
      ...(idOpts.description !== undefined ? { description: idOpts.description } : {}),
      ...(idOpts.parse ? { parse: idOpts.parse } : {}),
      resolve: (parent: unknown, _args: object, ctx: Types['Context']) =>
        idOpts.resolve ? idOpts.resolve(parent, ctx) : serializeId(parent),
    },
    loadWithoutCache: (id: IDShape, context: Types['Context'], info: GraphQLResolveInfo) => {
      // Per-request batching: calls at the same schema path coalesce
      // into one chained collection. The batcher builds `apply` from
      // one representative info per group (all entries share a
      // selection set by GraphQL semantics).
      const normalized = normalizeId(id);
      const groupKey = `${nodeModelName}:${pathKey(info.path)}`;
      return enqueueNodeLoad(context as object, groupKey, normalized, info, {
        collection: (ctx) => collection(ctx as Types['Context']) as never,
        buildIdPredicate: (ids) => {
          if (!isComposite) {
            const col = idFields[0]!;
            return (m: Record<string, unknown>) =>
              (m[col] as { in: (xs: readonly unknown[]) => unknown }).in(ids as readonly unknown[]);
          }
          // Composite: OR of per-tuple AND-of-eq predicates.
          return (m: Record<string, unknown>) =>
            or(
              ...(ids as unknown[][]).map(
                (tuple) =>
                  and(
                    ...(idFields.map((f, i) =>
                      (m[f] as { eq: (v: unknown) => unknown }).eq(tuple[i]),
                    ) as never[]),
                  ) as never,
              ),
            );
        },
        buildApply: (groupInfo) =>
          createApply({
            info: groupInfo,
            contract,
            context,
            mapperOpts: nodeMapperOpts,
            // info.returnType at `node(id:)` is the Node interface; the
            // mapper has to descend into the concrete type's inline
            // fragment. typeName diverges from modelName for variants.
            typeName,
            // Force-include id columns so the batcher can fan rows back
            // to per-id promises by id-field equality.
            extraColumns: idFields,
          }),
        idFields,
        brandRow: (row) => brandWithType(row, typeName as unknown as OutputType<Types>),
        typeName: nodeModelName,
      });
    },
  });

  return nodeRef as never;
} as never;
