import { PothosSchemaError } from '@pothos/core';
import { resolveStorageTable } from '@prisma/orm-family-sql/contract/resolve-storage-table';
import type { SqlModelStorage } from '@prisma/orm-family-sql/contract/types';
import type { ContractModelBase } from '@prisma/orm-framework/contract/types';
import type { AnyContract } from '../types/models.js';

type SqlContractModel = ContractModelBase<SqlModelStorage>;

interface ModelEntry {
  /** `Model` in a contract with one namespace, otherwise `namespace.Model`. */
  key: string;
  namespace: string;
  name: string;
  /** The contract's entry, which for a variant holds only its own fields. */
  raw: SqlContractModel;
  /** A variant's entry with its base's fields, relations and storage merged in. */
  merged: SqlContractModel;
  root: string;
  base: ModelEntry | undefined;
  variants: { value: string; key: string }[] | undefined;
}

interface ContractIndex {
  byKey: Map<string, ModelEntry>;
  byCoord: Map<string, ModelEntry>;
}

const indexes = new WeakMap<AnyContract, ContractIndex>();

function coord(to: { readonly model: string; readonly namespace: string }): string {
  return `${to.namespace}.${to.model}`;
}

function contractIndex(contract: AnyContract): ContractIndex {
  let index = indexes.get(contract);
  if (!index) {
    index = buildContractIndex(contract);
    indexes.set(contract, index);
  }
  return index;
}

function buildContractIndex(contract: AnyContract): ContractIndex {
  const namespaces = Object.entries(contract.domain.namespaces);
  const byKey = new Map<string, ModelEntry>();
  const byCoord = new Map<string, ModelEntry>();
  for (const [namespace, { models }] of namespaces) {
    for (const [name, model] of Object.entries(models)) {
      const key = namespaces.length > 1 ? `${namespace}.${name}` : name;
      const raw = model as SqlContractModel;
      const entry: ModelEntry = {
        key,
        namespace,
        name,
        raw,
        merged: raw,
        root: key,
        base: undefined,
        variants: undefined,
      };
      byKey.set(key, entry);
      byCoord.set(coord({ namespace, model: name }), entry);
    }
  }

  // A validated contract's variants have no variants of their own, so a base is never a variant.
  for (const entry of byKey.values()) {
    const base = entry.raw.base && byCoord.get(coord(entry.raw.base))!;
    if (base) {
      entry.base = base;
      entry.root = base.key;
      entry.merged = {
        ...entry.raw,
        fields: { ...base.raw.fields, ...entry.raw.fields },
        relations: { ...base.raw.relations, ...entry.raw.relations },
        storage: base.raw.storage,
      };
    }
    entry.variants =
      entry.raw.variants &&
      Object.entries(entry.raw.variants).map(([value, variant]) => ({
        value,
        key: byCoord.get(coord(variant))!.key,
      }));
  }
  return { byKey, byCoord };
}

function modelEntry(contract: AnyContract, modelKey: string): ModelEntry | undefined {
  return contractIndex(contract).byKey.get(modelKey);
}

export function resolveContractModel(
  contract: AnyContract,
  modelKey: string,
): SqlContractModel | undefined {
  return modelEntry(contract, modelKey)?.merged;
}

/** A variant's merged model carries its base's storage, but its own fields live in its table. */
export function fieldStorage(
  contract: AnyContract,
  modelKey: string,
  field: string,
): { namespaceId: string; table: string; column: string } | undefined {
  const entry = modelEntry(contract, modelKey);
  const storage = entry?.raw.storage;
  if (entry?.base && !(Object.hasOwn(entry.raw.fields, field) && storage?.table)) {
    return fieldStorage(contract, entry.base.key, field);
  }
  return storage?.table && storage.namespaceId
    ? {
        namespaceId: storage.namespaceId,
        table: storage.table,
        column: storage.fields?.[field]?.column ?? field,
      }
    : undefined;
}

export function relatedModelKey(
  contract: AnyContract,
  to: { readonly model: string; readonly namespace: string },
): string | undefined {
  return contractIndex(contract).byCoord.get(coord(to))?.key;
}

export function rootModelKey(contract: AnyContract, modelKey: string): string | undefined {
  return modelEntry(contract, modelKey)?.root;
}

export function modelDiscriminator(contract: AnyContract, modelKey: string) {
  const entry = modelEntry(contract, modelKey);
  return entry?.raw.discriminator && entry.variants
    ? { field: entry.raw.discriminator.field, variants: entry.variants }
    : undefined;
}

export function variantOf(
  contract: AnyContract,
  modelKey: string,
): { root: string; field: string; value: string; sharesTable: boolean } | undefined {
  const root = rootModelKey(contract, modelKey);
  if (root === undefined || root === modelKey) {
    return undefined;
  }
  const discriminator = modelDiscriminator(contract, root);
  const value = discriminator?.variants.find(({ key }) => key === modelKey)?.value;
  if (!discriminator || value === undefined) {
    return undefined;
  }
  const table = (model: string) => {
    const storage = modelEntry(contract, model)?.raw.storage;
    return storage?.table && `${storage.namespaceId}.${storage.table}`;
  };
  const own = table(modelKey);
  return { root, field: discriminator.field, value, sharesTable: !own || own === table(root) };
}

/** A multi-table variant's own fields and the key it shares with its base. */
export function variantTableFields(contract: AnyContract, modelKey: string): string[] | undefined {
  const entry = modelEntry(contract, modelKey);
  const storage = entry?.raw.storage;
  if (!entry?.base || !storage?.table || (variantOf(contract, modelKey)?.sharesTable ?? true)) {
    return undefined;
  }
  const key =
    resolveStorageTable(contract.storage, storage.table, storage.namespaceId)?.table.primaryKey
      ?.columns ?? [];
  const baseColumns = entry.base.raw.storage?.fields ?? {};
  return [
    ...Object.keys(entry.raw.fields),
    ...Object.keys(entry.base.raw.fields).filter((field) =>
      key.includes(baseColumns[field]?.column ?? field),
    ),
  ];
}

/** The variant a relation narrows to when its GraphQL type is backed by a variant of its target. */
export function variantForRelationType(
  contract: AnyContract,
  owner: string,
  targetModel: string,
  typeModel: string | undefined,
): string | undefined {
  if (typeModel === undefined || typeModel === targetModel) {
    return undefined;
  }
  if (rootModelKey(contract, typeModel) !== rootModelKey(contract, targetModel)) {
    throw new PothosSchemaError(
      `${owner} targets model '${targetModel}' but its type is backed by unrelated model '${typeModel}'.`,
    );
  }
  const variant = variantOf(contract, typeModel);
  if (!variant) {
    return undefined;
  }
  if (variant.root === targetModel) {
    return variant.value;
  }
  throw new PothosSchemaError(
    `${owner} targets model '${targetModel}' but its type is backed by model '${typeModel}'. ` +
      `A relation can be typed as a variant of its target only when it targets the base model '${variant.root}'.`,
  );
}

export function defaultTypeName(modelKey: string): string {
  return modelKey.slice(modelKey.indexOf('.') + 1);
}

/** SQLite and MySQL clients are the facet of their one namespace: `orm.<Model>`. */
export function collectionForModel(
  contract: AnyContract,
  collections: object,
  modelKey: string,
): unknown {
  const entry = modelEntry(contract, modelKey);
  if (!entry) {
    return undefined;
  }
  const entries = collections as Record<string, unknown>;
  const namespace = entries[entry.namespace] as Record<string, unknown> | undefined;
  return namespace?.[entry.name] ?? entries[modelKey];
}
