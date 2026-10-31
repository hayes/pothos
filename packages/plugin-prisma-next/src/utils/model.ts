import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import { type Codec, readContractValue } from '@prisma/orm-framework/components/codec';
import { canonicalStringify } from '@prisma/orm-framework/utils/canonical-stringify';
import type { AnyContract } from '../types.js';
import {
  fieldStorage,
  modelDiscriminator,
  relatedModelKey,
  resolveContractModel,
  rootModelKey,
  variantOf,
} from './contract.js';

export interface PrismaNextRelation {
  readonly isToMany: boolean;
  readonly targetModel: string;
  readonly target: PrismaNextModel;
  /** Set when a variant declares the relation; it can only be included after `.variant(value)`. */
  readonly variant?: string;
  /**
   * Set when the relation targets a variant model, which the ORM loads through that model's own
   * accessor: already narrowed, without the base's relations, and, when it shares the base's
   * table, unfiltered by the discriminator.
   */
  readonly targetVariant?: {
    readonly field: string;
    readonly value: string;
    readonly sharesTable: boolean;
  };
}

export interface PrismaNextModel {
  readonly name: string;
  readonly relations: Record<string, PrismaNextRelation>;
  /** Undefined when the contract doesn't describe the model. */
  readonly columns: ReadonlySet<string> | undefined;
}

function buildColumnSet(modelName: string, contract: AnyContract): ReadonlySet<string> | undefined {
  const fields = resolveContractModel(contract, modelName)?.fields;
  if (!fields) {
    return undefined;
  }
  // A base collection selects its variants' columns, leaving them absent on other variants' rows.
  const variants = Object.values(modelDiscriminator(contract, modelName)?.variants ?? {});
  return new Set([
    ...Object.keys(fields),
    ...variants.flatMap((variant) =>
      Object.keys(resolveContractModel(contract, relatedModelKey(contract, variant))?.fields ?? {}),
    ),
  ]);
}

const registries = new WeakMap<AnyContract, Map<string, PrismaNextModel>>();

/** Non-null unique keys, primary key first; undefined without SQL storage. */
export function getModelUniqueKeys(
  contract: AnyContract,
  modelName: string,
): string[][] | undefined {
  const model = resolveContractModel(contract, modelName);
  const storage = model?.storage;
  const table = storage?.table
    ? resolveStorageTable(contract.storage, storage.table, storage.namespaceId)?.table
    : undefined;
  if (!model || !table) {
    return undefined;
  }
  const keys = [
    ...(table.primaryKey ? [table.primaryKey.columns] : []),
    ...(table.uniques ?? []).map((key) => key.columns),
    ...(table.indexes ?? []).flatMap((index) =>
      index.unique && !index.where && index.columns ? [index.columns] : [],
    ),
  ];
  const uniqueKeys: string[][] = [];
  for (const columns of keys) {
    const fields = columns.map((column) =>
      Object.keys(model.fields).find(
        (field) =>
          (storage?.fields?.[field]?.column ?? field) === column && !model.fields[field].nullable,
      ),
    );
    if (fields.length && fields.every((field) => field !== undefined)) {
      uniqueKeys.push(fields as string[]);
    }
  }
  return uniqueKeys;
}

export function getIdentityFields(contract: AnyContract, modelName: string): string[] {
  return getModelUniqueKeys(contract, modelName)?.[0] ?? [];
}

/**
 * Cached per contract so model identity is object identity. A variant shares its base's model,
 * so `... on Bug` beneath a `Task` plans into the same query.
 */
export function getModel(contract: AnyContract, key: string): PrismaNextModel {
  const name = rootModelKey(contract, key);
  let models = registries.get(contract);

  if (!models) {
    models = new Map();
    registries.set(contract, models);
  }

  let model = models.get(name);

  if (!model) {
    const relations: Record<string, PrismaNextRelation> = {};

    model = { name, relations, columns: buildColumnSet(name, contract) };
    // Registered before its relations resolve, so a cycle finds it.
    models.set(name, model);

    const addRelations = (modelKey: string, variant?: string) => {
      for (const [relationName, relation] of Object.entries(
        resolveContractModel(contract, modelKey)?.relations ?? {},
      )) {
        if (variant !== undefined && relations[relationName]) {
          if (relations[relationName].variant === undefined) {
            continue;
          }
          throw new PothosSchemaError(
            `Relation '${relationName}' is declared by several variants of model '${name}'. ` +
              'Relations declared on variants need distinct names.',
          );
        }
        const targetModel = relatedModelKey(contract, relation.to);
        const target = variantOf(contract, targetModel);
        relations[relationName] = {
          // orm-client resolves N:M junctions itself, so they include like any to-many relation.
          isToMany: relation.cardinality === '1:N' || relation.cardinality === 'N:M',
          targetModel,
          target: getModel(contract, targetModel),
          ...(variant === undefined ? {} : { variant }),
          ...(target
            ? {
                targetVariant: {
                  field: target.field,
                  value: target.value,
                  sharesTable: target.sharesTable,
                },
              }
            : {}),
        };
      }
    };

    addRelations(name);
    // Relations declared on variants are tagged with the variant they need.
    for (const [value, variant] of Object.entries(
      modelDiscriminator(contract, name)?.variants ?? {},
    )) {
      addRelations(relatedModelKey(contract, variant), value);
    }
  }

  return model;
}

/** A column codec; cursors, IDs and loader identities hold values in its stored JSON form. */
export interface ColumnCodec {
  encode(value: unknown): unknown;
  decode(stored: unknown): unknown;
  /** Equal for values the column's data type holds equal, such as the decimals 0.5 and 0.50. */
  key(value: unknown): string;
}

/** The part of a client's execution context that holds the column codecs. */
export interface CodecContext {
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
}

export type FieldCodecs = (field: string) => ColumnCodec | undefined;

const codecCache = new WeakMap<CodecContext, Map<string, ColumnCodec | null>>();

export function getColumnCodec(
  contract: AnyContract,
  context: CodecContext,
  modelName: string,
  field: string,
): ColumnCodec | undefined {
  let codecs = codecCache.get(context);
  if (!codecs) {
    codecs = new Map();
    codecCache.set(context, codecs);
  }
  const cacheKey = `${modelName}\0${field}`;
  let columnCodec = codecs.get(cacheKey);
  if (columnCodec === undefined) {
    columnCodec = createColumnCodec(contract, context, modelName, field) ?? null;
    codecs.set(cacheKey, columnCodec);
  }
  return columnCodec ?? undefined;
}

function createColumnCodec(
  contract: AnyContract,
  context: CodecContext,
  modelName: string,
  field: string,
): ColumnCodec | undefined {
  const storage = fieldStorage(contract, modelName, field);
  if (!storage) {
    return undefined;
  }
  const { namespaceId, column } = storage;
  const codec = context.contractCodecs.forColumn(namespaceId, storage.table, column) as
    | Codec
    | undefined;
  if (!codec) {
    return undefined;
  }
  const table = resolveStorageTable(contract.storage, storage.table, namespaceId)?.table;
  const typeParams = (table?.columns[column] as { typeParams?: unknown } | undefined)?.typeParams;
  const encode = (value: unknown) => codec.dataType.toContract(codec.toDataTypeValue(value));
  return {
    encode,
    decode: (stored) => readContractValue(codec, stored as never, typeParams),
    key: (value) => {
      const stored = encode(value);
      return codec.dataType.equalityKey?.(stored) ?? canonicalStringify(stored);
    },
  };
}

/** Identity for a value whose column has no codec. */
export function rawKey(value: unknown): string {
  return canonicalStringify(value);
}
