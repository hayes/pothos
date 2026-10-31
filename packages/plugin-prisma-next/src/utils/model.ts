import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import { type Codec, readContractValue } from '@prisma/orm-framework/components/codec';
import type { AnyContract } from '../types.js';
import {
  modelDiscriminator,
  relatedModelKey,
  resolveContractModel,
  rootModelKey,
  variantOf,
} from './contract.js';

export interface PrismaNextRelationMeta {
  readonly isToMany: boolean;
  /** Parent-side join columns, always selected so nested includes can stitch. */
  readonly localFields: readonly string[];
  readonly targetModel: string;
  /**
   * The ORM loads a variant target through its own accessor, which can't include base relations
   * and, when `sharesTable`, isn't filtered by the discriminator.
   */
  readonly targetVariant?: {
    readonly model: string;
    readonly field: string;
    readonly value: string;
    readonly sharesTable: boolean;
  };
}

export interface PrismaNextRelation extends PrismaNextRelationMeta {
  readonly target: PrismaNextModel;
  /** Set when a variant declares the relation; it can only be included after `.variant(value)`. */
  readonly variant?: string;
}

export interface PrismaNextModel {
  readonly name: string;
  readonly relations: Record<string, PrismaNextRelation>;
  /** Undefined when the contract doesn't describe the model. */
  readonly columns: ReadonlySet<string> | undefined;
}

export function buildRelationMeta(
  modelName: string,
  contract: AnyContract,
  typeName: string,
): Record<string, PrismaNextRelationMeta> | undefined {
  const rels = resolveContractModel(contract, modelName)?.relations;
  if (!rels) {
    return undefined;
  }
  const out: Record<string, PrismaNextRelationMeta> = {};
  for (const [name, rel] of Object.entries(rels)) {
    // orm-client resolves N:M junctions itself, so they include like any to-many relation.
    const isToMany = rel.cardinality === '1:N' || rel.cardinality === 'N:M';
    // Rejects cardinalities a future contract might add.
    if (!isToMany && rel.cardinality !== '1:1' && rel.cardinality !== 'N:1') {
      throw new PothosSchemaError(
        `Relation '${typeName}.${name}' (model '${modelName}') has unknown cardinality ` +
          `'${rel.cardinality}'. Expected '1:1' / 'N:1' / '1:N' / 'N:M'.`,
      );
    }
    const targetModel = relatedModelKey(contract, rel.to);
    const target = variantOf(contract, targetModel);
    out[name] = {
      isToMany,
      // Embeds have no `on`; for N:M these are the parent columns the junction references.
      localFields: 'on' in rel ? rel.on.localFields : [],
      targetModel,
      ...(target
        ? {
            targetVariant: {
              model: targetModel,
              field: target.field,
              value: target.value,
              sharesTable: target.sharesTable,
            },
          }
        : {}),
    };
  }
  return out;
}

export function buildColumnSet(
  modelName: string,
  contract: AnyContract,
): ReadonlySet<string> | undefined {
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
  const storage = model?.storage as
    | {
        table?: string;
        namespaceId?: string;
        fields?: Record<string, { column?: string }>;
      }
    | undefined;
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

    const meta = buildRelationMeta(name, contract, name) ?? {};

    for (const relation of Object.keys(meta)) {
      relations[relation] = {
        ...meta[relation],
        target: getModel(contract, meta[relation].targetModel),
      };
    }

    // Relations declared on variants are tagged with the variant they need.
    for (const [value, variant] of Object.entries(
      modelDiscriminator(contract, name)?.variants ?? {},
    )) {
      const variantKey = relatedModelKey(contract, variant);
      const variantMeta = buildRelationMeta(variantKey, contract, variantKey) ?? {};
      for (const relation of Object.keys(variantMeta)) {
        if (Object.hasOwn(meta, relation)) {
          continue;
        }
        if (relations[relation]) {
          throw new PothosSchemaError(
            `Relation '${relation}' is declared by several variants of model '${name}'. ` +
              'Relations declared on variants need distinct names.',
          );
        }
        relations[relation] = {
          ...variantMeta[relation],
          variant: value,
          target: getModel(contract, variantMeta[relation].targetModel),
        };
      }
    }
  }

  return model;
}

export interface ColumnCodec {
  toStored(value: unknown): unknown;
  fromStored(stored: unknown): unknown;
}

/** A Prisma client's `context`, which holds the column codecs. */
export interface PrismaNextCodecContext {
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
}

export function getColumnCodec(
  contract: AnyContract,
  modelName: string,
  field: string,
  context: PrismaNextCodecContext | undefined,
): ColumnCodec | undefined {
  const storage = resolveContractModel(contract, modelName)?.storage as
    | { table?: string; namespaceId?: string; fields?: Record<string, { column?: string }> }
    | undefined;
  if (!context || !storage?.table || !storage.namespaceId) {
    return undefined;
  }
  const column = storage.fields?.[field]?.column ?? field;
  const codec = context.contractCodecs.forColumn(storage.namespaceId, storage.table, column) as
    | Codec
    | undefined;
  if (!codec) {
    return undefined;
  }
  const table = resolveStorageTable(contract.storage, storage.table, storage.namespaceId)?.table;
  const typeParams = (table?.columns[column] as { typeParams?: unknown } | undefined)?.typeParams;
  return {
    toStored: (value) => codec.dataType.toContract(codec.toDataTypeValue(value)),
    fromStored: (stored) => readContractValue(codec, stored as never, typeParams),
  };
}
