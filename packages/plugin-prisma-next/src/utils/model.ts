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
   * The ORM loads a variant model's rows through its own accessor, which lacks the base's
   * relations and, sharing the base's table, isn't filtered by the discriminator.
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
  /** Relation names several variants declare, which a query level can't hold, so none load. */
  readonly sharedVariantRelations: ReadonlySet<string>;
  readonly columns: ReadonlySet<string>;
  /** The first identity, which variants share. Empty for a model without one. */
  readonly identity: readonly string[];
  /** The columns each multi-table variant's own accessor reads, by discriminator value. */
  readonly variantTableColumns: ReadonlyMap<string, ReadonlySet<string>>;
}

export function sharedVariantRelationError(owner: string, name: string, model: PrismaNextModel) {
  return new PothosSchemaError(
    `Relation '${name}' on ${owner} is declared under the same name by several variants of model '${model.key}', so it can't be loaded. Give it a name no other variant uses.`,
  );
}

export function ownTableVariantRowsError(
  subject: string,
  name: string,
  { targetModel }: PrismaNextRelation,
) {
  return new PothosSchemaError(
    `${subject} the rows of relation '${name}', which targets variant model '${targetModel}' with a table of its own. Those rows load from that table alone, without the base model's columns. Return them as an object type of '${targetModel}' (t.relation, t.relatedConnection or a field select), or relate to the base model.`,
  );
}

/**
 * Own-table variant rows lack the base's columns (such as the discriminator `resolveType` reads),
 * so only an object type of the relation's target can take them.
 */
export function returnsRelationRowsAs(
  relation: PrismaNextRelation,
  kind: string,
  model: PrismaNextModel | undefined,
) {
  return (
    relation.targetVariantModel?.sharesTable !== false ||
    (kind === 'Object' && model === relation.target)
  );
}

function buildColumnSet(contract: AnyContract, modelKey: string): ReadonlySet<string> {
  const fields = resolveContractModel(contract, modelKey)?.fields ?? {};
  // A base collection also selects its variants' columns.
  const variants = modelDiscriminator(contract, modelKey)?.variants ?? [];
  return new Set([
    ...Object.keys(fields),
    ...variants.flatMap(({ key }) =>
      Object.keys(resolveContractModel(contract, key)?.fields ?? {}),
    ),
  ]);
}

/** Non-null primary and unique keys, primary first. Undefined without SQL storage. */
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

/**
 * Timestamp codecs that read as a `Date`, with their default precision. Codecs don't expose the
 * type they read as, so these are listed by id.
 */
const DATE_CODEC_DEFAULT_PRECISION = new Map([
  ['pg/timestamptz-date@1', 6],
  ['pg/timestamp-date@1', 6],
  ['mysql/datetime@1', 0],
]);

/** A timestamp finer than milliseconds comes back from a `Date` changed, so can't be a cursor. */
export function truncatedDateProblem(
  contract: AnyContract,
  modelKey: string,
  field: string,
): string | undefined {
  const type = resolveContractModel(contract, modelKey)?.fields[field]?.type as
    | { codecId?: string; typeParams?: { precision?: number } }
    | undefined;
  const defaultPrecision = DATE_CODEC_DEFAULT_PRECISION.get(type?.codecId ?? '');
  return defaultPrecision !== undefined && (type?.typeParams?.precision ?? defaultPrecision) > 3
    ? `'${modelKey}.${field}' is a timestamp finer than milliseconds read as a JavaScript Date, which drops the rest. Declare it with a precision of 3 or less, or with a codec that reads a Temporal value, such as TimestamptzTemporal`
    : undefined;
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
    let identity: readonly string[] | undefined;

    model = {
      key: root,
      relations,
      sharedVariantRelations,
      columns: buildColumnSet(contract, root),
      get identity() {
        identity ??= getModelIdentities(contract, root)?.[0] ?? [];
        return identity;
      },
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
    for (const { key: variant, value } of modelDiscriminator(contract, root)?.variants ?? []) {
      addRelations(variant, value);
    }
    for (const relationName of sharedVariantRelations) {
      delete relations[relationName];
    }
  }

  return model;
}
