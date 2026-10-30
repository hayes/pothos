/**
 * The model description the adapter's nodes carry: one object per contract model, so model
 * identity is model equality (what the walker's fragment and path rules compare). Built from the
 * contract on first use and cached per contract; relation targets resolve through the same
 * registry, so a cycle (`User.posts` → `Post.author` → `User`) closes on the same objects.
 */
import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import { type Codec, readContractValue } from '@prisma/orm-framework/components/codec';
import type { AnyContract } from '../types.js';
import { resolveContractModel } from './contract.js';

/**
 * Per-relation metadata baked into the type's extension at schema
 * build. Cardinality detection runs here once, fail-fast.
 */
export interface PrismaNextRelationMeta {
  readonly isToMany: boolean;
  /**
   * Parent-side columns the join keys against; augmented into the parent
   * SELECT for depth-2+ stitching. For a reference relation these are the
   * parent FK columns (`on.localFields`); for an N:M relation they are the
   * parent columns the junction references (also `on.localFields`, which
   * prisma-next resolves into `through.parentLocalColumns`).
   */
  readonly localFields: readonly string[];
  /** Target model name in the contract. */
  readonly targetModel: string;
}

/** A relation as the adapter sees it: the metadata plus the target model itself. */
export interface PrismaNextRelation extends PrismaNextRelationMeta {
  readonly target: PrismaNextModel;
}

export interface PrismaNextModel {
  readonly name: string;
  readonly relations: Record<string, PrismaNextRelation>;
  /** The model's columns, or undefined when the contract does not describe the model. */
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
    // N:M is a to-many junction relation. As of prisma-next 0.14.0 the
    // orm-client resolves the junction join internally from the
    // relation's `through` block (see tests/prisma-next-m-n-upstream-pin),
    // so `.include('<n:m rel>')` flattens the related rows in a single
    // query. The plugin emits the include like any other to-many relation
    // and carries the `through` descriptor as the junction marker. (The
    // contract tags this 'N:M'; there is no 'M:N' spelling in either
    // prisma-next package.)
    const isToMany = rel.cardinality === '1:N' || rel.cardinality === 'N:M';
    // Explicit allowlist: guards against new cardinality tags a future
    // contract might grow. With today's union this leaves '1:1' / 'N:1'.
    if (!isToMany && rel.cardinality !== '1:1' && rel.cardinality !== 'N:1') {
      throw new PothosSchemaError(
        `Relation '${typeName}.${name}' (model '${modelName}') has unknown cardinality ` +
          `'${rel.cardinality}'. Expected '1:1' / 'N:1' / '1:N' / 'N:M'.`,
      );
    }
    out[name] = {
      isToMany,
      // Embed relations carry no FK columns (`on`); reference and junction
      // relations do. For N:M these are the parent columns the junction
      // references (prisma-next resolves them into `through.parentLocalColumns`),
      // so augmenting them into the parent SELECT is correct — the parent
      // has no direct FK, but it does have the keyed columns the junction
      // joins against.
      localFields: 'on' in rel ? rel.on.localFields : [],
      targetModel: rel.to.model,
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
  return new Set(Object.keys(fields));
}

const registries = new WeakMap<AnyContract, Map<string, PrismaNextModel>>();

/** Non-null unique keys in model field names, primary key first; undefined without SQL storage. */
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

/** Prefer the primary key, then the first non-null unique key. */
export function getIdentityFields(contract: AnyContract, modelName: string): string[] {
  return getModelUniqueKeys(contract, modelName)?.[0] ?? [];
}

/** The one `PrismaNextModel` for `name` under `contract`. */
export function getModel(contract: AnyContract, name: string): PrismaNextModel {
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
  }

  return model;
}

/** A column's values to and from the JSON form its contract stores. */
export interface ColumnCodec {
  toStored(value: unknown): unknown;
  fromStored(stored: unknown): unknown;
}

/** The `context` of a Prisma client, which holds the contract's column codecs. */
export interface PrismaNextCodecContext {
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
}

/** The codec the client built for a model field's column. */
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
