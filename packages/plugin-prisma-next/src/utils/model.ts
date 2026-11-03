import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import type { AnyContract } from '../types/models.js';
import {
  modelDiscriminator,
  relatedModelKey,
  resolveContractModel,
  rootModelKey,
  variantOf,
  variantTableFields,
} from './contract.js';

export interface PrismaNextRelation {
  readonly isToMany: boolean;
  readonly targetModel: string;
  readonly target: PrismaNextModel;
  /** The variant that declares the relation. It can only be included after `.variant(value)`. */
  readonly declaredByVariant?: string;
  /**
   * Set when the relation targets a variant model. The ORM loads its rows through that model's
   * own accessor, which lacks the base's relations and, when the variant shares the base's table,
   * isn't filtered by the discriminator.
   */
  readonly targetVariantModel?: {
    readonly field: string;
    readonly value: string;
    readonly sharesTable: boolean;
  };
}

export interface PrismaNextModel {
  /** The model key of the hierarchy's root. */
  readonly key: string;
  readonly relations: Record<string, PrismaNextRelation>;
  /**
   * Relation names several variants declare. A level of the query holds one relation of a name,
   * so none of them is in `relations`, and the rest of the hierarchy loads without them.
   */
  readonly sharedVariantRelations: ReadonlySet<string>;
  readonly columns: ReadonlySet<string>;
  /**
   * The columns each multi-table variant's own accessor reads, by discriminator value. A relation
   * targeting such a variant model loads through it, so the base's other columns load separately.
   */
  readonly variantTableColumns: ReadonlyMap<string, ReadonlySet<string>>;
}

/**
 * The error for loading a relation name several variants of `model` declare: a `PothosSchemaError`
 * when the schema is built, and an `Error` for a `select` a function returned for a request.
 */
export function sharedVariantRelationError(
  owner: string,
  name: string,
  model: PrismaNextModel,
  ErrorClass: new (message: string) => Error = PothosSchemaError,
) {
  return new ErrorClass(
    `Relation '${name}' on ${owner} is declared under the same name by several variants of model '${model.key}', so it can't be loaded. Give it a name no other variant uses.`,
  );
}

function buildColumnSet(contract: AnyContract, modelKey: string): ReadonlySet<string> {
  const fields = resolveContractModel(contract, modelKey)?.fields ?? {};
  // A base collection also selects its variants' columns, so they count as the model's columns
  // even though other variants' rows lack them.
  const variants = modelDiscriminator(contract, modelKey)?.variants ?? [];
  return new Set([
    ...Object.keys(fields),
    ...variants.flatMap(({ key }) =>
      Object.keys(resolveContractModel(contract, key)?.fields ?? {}),
    ),
  ]);
}

/**
 * A model's identities: its non-null primary and unique keys, primary key first. Undefined for a
 * model without SQL storage.
 */
export function getModelIdentities(
  contract: AnyContract,
  modelKey: string,
): string[][] | undefined {
  const model = resolveContractModel(contract, modelKey);
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
  const identities: string[][] = [];
  for (const columns of keys) {
    const fields = columns.map((column) =>
      Object.keys(model.fields).find(
        (field) =>
          (storage?.fields?.[field]?.column ?? field) === column && !model.fields[field].nullable,
      ),
    );
    if (fields.length && fields.every((field) => field !== undefined)) {
      identities.push(fields as string[]);
    }
  }
  return identities;
}

/** Postgres timestamps read as a JavaScript `Date`, which holds milliseconds. */
const DATE_TIMESTAMP_CODECS = new Set(['pg/timestamptz-date@1', 'pg/timestamp-date@1']);

/**
 * Why a field's values can't place a row in a cursor or node ID, if they can't: a timestamp finer
 * than milliseconds comes back from a `Date` changed. Bare `DateTime` is `timestamptz(3)`.
 */
export function truncatedDateProblem(
  contract: AnyContract,
  modelKey: string,
  field: string,
): string | undefined {
  const type = resolveContractModel(contract, modelKey)?.fields[field]?.type as
    | { codecId?: string; typeParams?: { precision?: number } }
    | undefined;
  return type?.codecId &&
    DATE_TIMESTAMP_CODECS.has(type.codecId) &&
    !((type.typeParams?.precision ?? 6) <= 3)
    ? `'${modelKey}.${field}' is a timestamp finer than milliseconds read as a JavaScript Date, which drops the rest. Declare it as TimestamptzTemporal, or with a precision of 3 or less`
    : undefined;
}

export function getIdentityFields(contract: AnyContract, modelKey: string): string[] {
  return getModelIdentities(contract, modelKey)?.[0] ?? [];
}

const modelCache = new WeakMap<AnyContract, Map<string, PrismaNextModel>>();

/**
 * Cached per contract so model identity is object identity. A variant shares its base's model,
 * so `... on Bug` beneath a `Task` plans into the same query.
 */
export function getModel(contract: AnyContract, key: string): PrismaNextModel {
  const root = rootModelKey(contract, key) ?? key;
  let models = modelCache.get(contract);

  if (!models) {
    models = new Map();
    modelCache.set(contract, models);
  }

  let model = models.get(root);

  if (!model) {
    const relations: Record<string, PrismaNextRelation> = {};
    const sharedVariantRelations = new Set<string>();

    model = {
      key: root,
      relations,
      sharedVariantRelations,
      columns: buildColumnSet(contract, root),
      variantTableColumns: new Map(
        (modelDiscriminator(contract, root)?.variants ?? []).flatMap(({ key, value }) => {
          const fields = variantTableFields(contract, key);
          return fields ? [[value, new Set(fields)] as const] : [];
        }),
      ),
    };
    // Registered before its relations resolve, so a cycle finds it.
    models.set(root, model);

    const addRelations = (modelKey: string, variant?: string) => {
      for (const [relationName, relation] of Object.entries(
        resolveContractModel(contract, modelKey)?.relations ?? {},
      )) {
        if (variant !== undefined && relations[relationName]) {
          if (relations[relationName].declaredByVariant !== undefined) {
            sharedVariantRelations.add(relationName);
          }
          continue;
        }
        const targetModel = relatedModelKey(contract, relation.to)!;
        const targetVariant = variantOf(contract, targetModel);
        relations[relationName] = {
          // orm-client resolves N:M junctions itself, so they include like any to-many relation.
          isToMany: relation.cardinality === '1:N' || relation.cardinality === 'N:M',
          targetModel,
          target: getModel(contract, targetModel),
          ...(variant === undefined ? {} : { declaredByVariant: variant }),
          ...(targetVariant
            ? {
                targetVariantModel: {
                  field: targetVariant.field,
                  value: targetVariant.value,
                  sharesTable: targetVariant.sharesTable,
                },
              }
            : {}),
        };
      }
    };

    addRelations(root);
    // Relations declared on variants are tagged with the variant they need.
    for (const { key: variant, value } of modelDiscriminator(contract, root)?.variants ?? []) {
      addRelations(variant, value);
    }
    for (const relationName of sharedVariantRelations) {
      delete relations[relationName];
    }
  }

  return model;
}
