/**
 * The model description the adapter's nodes carry: one object per contract model, so model
 * identity is model equality (what the walker's fragment and path rules compare). Built from the
 * contract on first use and cached per contract; relation targets resolve through the same
 * registry, so a cycle (`User.posts` → `Post.author` → `User`) closes on the same objects.
 */
import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import type { AnyContract } from '../types.js';
import { resolveContractModel } from './contract.js';

/**
 * Junction descriptor for an N:M relation, mirroring prisma-next's
 * `ContractRelationThrough`. Present only on many-to-many relations; the
 * walker uses its presence as the "this is a junction relation" flag and
 * carries the columns for any future junction-aware stitching.
 */
export interface PrismaNextRelationThrough {
  /** Junction table name. */
  readonly table: string;
  /** Namespace that owns the junction table. */
  readonly namespaceId: string;
  /** Junction FK columns → parent. */
  readonly parentColumns: readonly string[];
  /** Junction FK columns → target. */
  readonly childColumns: readonly string[];
  /** Target PK columns referenced by `childColumns`. */
  readonly targetColumns: readonly string[];
}

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
  /**
   * Junction descriptor for N:M relations; `undefined` for reference and
   * embed relations. Its presence marks the relation as a junction join
   * (prisma-next emits the junction query internally from the contract's
   * `through`, so the walker just needs to know it exists).
   */
  readonly through?: PrismaNextRelationThrough;
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
      // N:M relations carry a `through`; the union narrows to
      // `ContractManyToManyRelation` on the cardinality check.
      ...(rel.cardinality === 'N:M' ? { through: rel.through } : {}),
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

/** Prefer the primary key, then a non-null unique key, using model field names. */
export function getIdentityFields(contract: AnyContract, modelName: string): string[] {
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
  const keys = [
    ...(table?.primaryKey ? [table.primaryKey.columns] : []),
    ...(table?.uniques ?? []).map((key) => key.columns),
    ...(table?.indexes ?? []).flatMap((index) =>
      index.unique && !index.where && index.columns ? [index.columns] : [],
    ),
  ];
  for (const columns of keys) {
    const fields = columns.map((column) =>
      Object.keys(model!.fields).find(
        (field) =>
          (storage?.fields?.[field]?.column ?? field) === column && !model!.fields[field].nullable,
      ),
    );
    if (fields.length && fields.every((field) => field !== undefined)) {
      return fields as string[];
    }
  }
  return [];
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
