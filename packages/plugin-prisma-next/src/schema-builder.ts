import SchemaBuilder, {
  brandWithType,
  decodeCursorChunk,
  encodeCursorChunk,
  encodeCursorTuple,
  type InterfaceRef,
  type OutputType,
  PothosSchemaError,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { and, or } from '@prisma/orm-family-sql/orm-client';
import type { GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_FIELD_SELECT, PRISMA_NEXT_MODEL, PRISMA_NEXT_SELECT } from './constants.js';
import { PrismaNextInterfaceRef } from './interface-ref.js';
import { PrismaNextNodeRef } from './node-ref.js';
import { PrismaNextObjectRef } from './object-ref.js';
import { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
import type { ModelName, PrismaNextObjectOptions } from './types.js';
import { createApply } from './utils/apply.js';
import { CURSOR_PAYLOAD_MAX_BYTES, type CursorValueCodec } from './utils/cursors.js';
import { enqueueNodeLoad, pathKey } from './utils/node-batch.js';
import { mapperOptionsFromPluginOpts, readPluginOptions } from './utils/options.js';
import {
  assertSameKindRegistration,
  getInterfaceRefFromContractModel,
  getRefFromContractModel,
} from './utils/refs.js';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

/**
 * The body of `prismaObject` and `prismaInterface`. The two build the same ref, extensions and
 * field builder; only the ref class, the ref cache and which of `objectType`/`interfaceType`
 * registers it differ.
 *
 * `variant` wins over legacy `name`; both claim a variant identity (a second registration for the
 * same model under a different GraphQL type name). Variants get a fresh ref; a default
 * registration reuses the cached one, so sibling `t.relation` and string-form helpers resolve to
 * the same instance.
 */
function definePrismaNextType<Types extends SchemaTypes, M extends ModelName<Types>>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  modelName: M,
  options: PrismaNextObjectOptions<Types, M, unknown, never[]>,
  kind: 'interface' | 'object',
) {
  const isInterface = kind === 'interface';
  const typeName =
    (options as { variant?: string }).variant ?? options.name ?? (modelName as string);
  const isVariant = typeName !== (modelName as string);
  const ref = isVariant
    ? isInterface
      ? new PrismaNextInterfaceRef<Types, M>(typeName, modelName)
      : new PrismaNextObjectRef<Types, M>(typeName, modelName)
    : isInterface
      ? getInterfaceRefFromContractModel<Types, M>(modelName, builder)
      : getRefFromContractModel<Types, M>(modelName, builder);

  if (!isVariant) {
    assertSameKindRegistration(builder, modelName as string, kind);
  }

  const contract = readPluginOptions<Types['PrismaNextContract']>(builder)?.contract;
  const config = {
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
              `builder.prisma${isInterface ? 'Interface' : 'Object'}('${modelName as string}', ...) requires builder.options.prismaNext.contract to be set.`,
            );
          }

          return options.fields!(
            new PrismaNextObjectFieldBuilder<Types, M>(builder, modelName, contract) as never,
          );
        }
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
 * The ref and field builder behind the four cross-file field helpers, which differ only in kind
 * and in whether they add one field or a map of them.
 */
function fieldsFor<Types extends SchemaTypes, M extends ModelName<Types>>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | { modelName: M },
  kind: 'interface' | 'object',
  build: (t: PrismaNextObjectFieldBuilder<Types, M>) => unknown,
) {
  const modelName = typeof type === 'string' ? type : type.modelName;
  const ref =
    typeof type === 'string'
      ? kind === 'interface'
        ? getInterfaceRefFromContractModel<Types, M>(modelName, builder)
        : getRefFromContractModel<Types, M>(modelName, builder)
      : type;

  return {
    ref: ref as never,
    fields: () => {
      const contract = readPluginOptions<Types['PrismaNextContract']>(builder)?.contract;

      if (!contract) {
        throw new PothosSchemaError(
          'cross-file field helpers require builder.options.prismaNext.contract.',
        );
      }

      return build(new PrismaNextObjectFieldBuilder<Types, M>(builder, modelName, contract));
    },
  };
}

type FieldHelper<Types extends SchemaTypes, M extends ModelName<Types>> = (
  t: PrismaNextObjectFieldBuilder<Types, M>,
) => unknown;

schemaBuilderProto.prismaObjectField = function prismaObjectField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextObjectRef<Types, M, unknown>,
  fieldName: string,
  field: FieldHelper<Types, M>,
) {
  const { ref, fields } = fieldsFor(this, type as never, 'object', field);

  this.objectField(ref, fieldName, fields as never);
} as never;

schemaBuilderProto.prismaObjectFields = function prismaObjectFields<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextObjectRef<Types, M, unknown>,
  fields: FieldHelper<Types, M>,
) {
  const built = fieldsFor(this, type as never, 'object', fields);

  this.objectFields(built.ref, built.fields as never);
} as never;

schemaBuilderProto.prismaInterfaceField = function prismaInterfaceField<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextInterfaceRef<Types, M, unknown>,
  fieldName: string,
  field: FieldHelper<Types, M>,
) {
  const { ref, fields } = fieldsFor(this, type as never, 'interface', field);

  this.interfaceField(ref, fieldName, fields as never);
} as never;

schemaBuilderProto.prismaInterfaceFields = function prismaInterfaceFields<
  Types extends SchemaTypes,
  M extends ModelName<Types>,
>(
  this: PothosSchemaTypes.SchemaBuilder<Types>,
  type: M | PrismaNextInterfaceRef<Types, M, unknown>,
  fields: FieldHelper<Types, M>,
) {
  const built = fieldsFor(this, type as never, 'interface', fields);

  this.interfaceFields(built.ref, built.fields as never);
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
          extensions?: Record<string, unknown>;
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
      codecs?: Record<string, CursorValueCodec>;
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

  // The Relay loader brands its results for abstract Node resolution. Concrete
  // fields and relations do not need brands; a default brand-only isTypeOf would
  // reject the ordinary ORM rows returned by those paths. Preserve a user's
  // discriminator predicate exactly, matching the Prisma and Drizzle plugins.
  const objectRef = this.prismaObject(modelName as never, rest as never);

  this.configStore.associateParamWithRef(nodeRef as never, objectRef as never);

  // Tagged chunks preserve bigint/date/bytes within compound IDs. Plain
  // string IDs remain readable; escape the reserved prefix when necessary.
  const serializeId = (parent: unknown): string => {
    const row = parent as Record<string, unknown>;
    const values = idFields.map((field) => {
      const value = row[field];
      const codec = idOpts.codecs?.[field];
      if (codec) {
        return codec.encode(value);
      }
      if (
        !idOpts.parse &&
        value !== null &&
        typeof value === 'object' &&
        !(value instanceof Date) &&
        !(value instanceof Uint8Array)
      ) {
        throw new PothosSchemaError(
          `prismaNode '${modelName as string}' requires an id.codecs entry for custom scalar field '${field}'.`,
        );
      }
      return value;
    });
    if (idOpts.parse) {
      // A custom parser owns its wire format; preserve the previous raw scalar / JSON tuple form.
      return isComposite ? JSON.stringify(values) : String(values[0]);
    }
    if (isComposite) {
      return `PNI:${encodeCursorTuple(values)}`;
    }
    const value = values[0];
    return typeof value === 'string' && !value.startsWith('PNI:')
      ? value
      : `PNI:${encodeCursorChunk(value)}`;
  };

  if (!pluginOpts) {
    throw new PothosSchemaError('prismaNode requires builder.options.prismaNext to be set.');
  }
  const nodeMapperOpts = mapperOptionsFromPluginOpts(pluginOpts);
  const nodeModelName = modelName as string;
  const contract = pluginOpts.contract;

  const normalizeId = (id: IDShape): IDShape => {
    let parsed: unknown = id;
    if (!idOpts.parse && typeof id === 'string') {
      if (id.length > CURSOR_PAYLOAD_MAX_BYTES) {
        throw new PothosValidationError(
          `prismaNode '${nodeModelName}' ID payload exceeds ${CURSOR_PAYLOAD_MAX_BYTES} bytes.`,
        );
      }
      try {
        parsed = id.startsWith('PNI:')
          ? decodeCursorChunk(id.slice(4))
          : isComposite
            ? JSON.parse(id)
            : id;
      } catch {
        throw new PothosValidationError(`prismaNode '${nodeModelName}' ID payload is invalid.`);
      }
    }
    if (isComposite && (!Array.isArray(parsed) || parsed.length !== idFields.length)) {
      throw new PothosValidationError(
        `prismaNode '${nodeModelName}' composite ID expected ${idFields.length} values, got ${Array.isArray(parsed) ? parsed.length : 'a non-array value'}.`,
      );
    }
    if (!idOpts.parse && idOpts.codecs) {
      const values = isComposite ? (parsed as unknown[]) : [parsed];
      const decoded = idFields.map((field, i) => {
        const codec = idOpts.codecs?.[field];
        if (!codec) {
          return values[i];
        }
        try {
          if (typeof values[i] !== 'string') {
            throw new Error('Expected encoded string');
          }
          return codec.decode(values[i]);
        } catch {
          throw new PothosValidationError(
            `prismaNode '${nodeModelName}' ID has an invalid ${field} value.`,
          );
        }
      });
      parsed = isComposite ? decoded : decoded[0];
    }
    return parsed as IDShape;
  };

  this.nodeRef(objectRef as never, {
    id: {
      extensions: { [PRISMA_NEXT_FIELD_SELECT]: { columns: idFields } },
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
      // Keyed on the GraphQL type, not the model: two variants of one model are two
      // registrations with their own selection and brand, and sharing a batch would hand one
      // variant's rows to the other.
      const groupKey = `${typeName}:${pathKey(info.path)}`;
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
        ...(idOpts.codecs
          ? {
              keyForValues: (values: readonly unknown[]) =>
                encodeCursorTuple(
                  idFields.map(
                    (field, i) => idOpts.codecs?.[field]?.encode(values[i]) ?? values[i],
                  ),
                ),
            }
          : {}),
        brandRow: (row) => brandWithType(row, typeName as unknown as OutputType<Types>),
      });
    },
  });

  return nodeRef as never;
} as never;
