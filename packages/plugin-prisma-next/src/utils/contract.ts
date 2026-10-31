import { PothosSchemaError, PothosValidationError } from '@pothos/core';
import { resolveDomainModel } from '@prisma/orm-framework/contract/resolve-domain-model';
import type { ContractModelBase } from '@prisma/orm-framework/contract/types';
import type { AnyContract } from '../types.js';

function namespacesWithModel(contract: AnyContract, model: string): string[] {
  return Object.entries(contract.domain.namespaces)
    .filter(([, namespace]) => Object.hasOwn(namespace.models, model))
    .map(([id]) => id);
}

/**
 * Resolve a model definition by its key, delegating to the ORM's `resolveDomainModel`. A key is a
 * bare model name, or `namespace.Model` for a name several namespaces share: the ORM's resolver
 * would pick the first of those, silently loading another model's fields.
 * Mirrors the type-level `ModelDefOf` in `../types`.
 */
export function resolveContractModel(
  contract: AnyContract,
  modelKey: string,
): ContractModelBase | undefined {
  const model = lookupModel(contract, modelKey);
  const base = baseModelRef(model);
  if (!base) {
    return model;
  }
  // A variant's contract entry holds only its own fields. Its rows, identity and relations also
  // come from its base model, which is what the ORM queries it through.
  const parent = resolveContractModel(contract, relatedModelKey(contract, base))!;
  return {
    ...model!,
    fields: { ...parent.fields, ...model!.fields },
    relations: { ...parent.relations, ...model!.relations },
    storage: parent.storage,
  };
}

function baseModelRef(model: ContractModelBase | undefined) {
  return (model as { base?: { model: string; namespace: string } } | undefined)?.base;
}

function lookupModel(contract: AnyContract, modelKey: string): ContractModelBase | undefined {
  const separator = modelKey.indexOf('.');
  if (separator >= 0) {
    const model = modelKey.slice(separator + 1);
    if (namespacesWithModel(contract, model).length === 1) {
      throw new PothosSchemaError(
        `Model '${modelKey}' is not ambiguous. Use the bare name '${model}'.`,
      );
    }
    return contract.domain.namespaces[modelKey.slice(0, separator)]?.models[model];
  }
  const namespaces = namespacesWithModel(contract, modelKey);
  if (namespaces.length > 1) {
    throw new PothosSchemaError(
      `Model '${modelKey}' exists in namespaces ${namespaces.map((id) => `'${id}'`).join(', ')}. ` +
        `Use a qualified name: ${namespaces.map((id) => `'${id}.${modelKey}'`).join(', ')}.`,
    );
  }
  return resolveDomainModel(contract.domain, modelKey)?.model;
}

/** The key of a relation's target: bare, unless other namespaces share its name. */
export function relatedModelKey(
  contract: AnyContract,
  to: { readonly model: string; readonly namespace: string },
): string {
  return namespacesWithModel(contract, to.model).length > 1
    ? `${to.namespace}.${to.model}`
    : to.model;
}

/** The model a variant inherits from, following `@@base`; any other model is its own root. */
export function rootModelKey(contract: AnyContract, modelKey: string): string {
  const base = baseModelRef(lookupModel(contract, modelKey));
  return base ? rootModelKey(contract, relatedModelKey(contract, base)) : modelKey;
}

/** The discriminator a hierarchy's base model routes rows with, and its variants by value. */
export function modelDiscriminator(
  contract: AnyContract,
  modelKey: string,
): { field: string; variants: Record<string, { model: string; namespace: string }> } | undefined {
  const model = lookupModel(contract, modelKey) as
    | {
        discriminator?: { field: string };
        variants?: Record<string, { model: string; namespace: string }>;
      }
    | undefined;
  return model?.discriminator && model.variants
    ? { field: model.discriminator.field, variants: model.variants }
    : undefined;
}

/**
 * Where a variant model sits in its hierarchy: its root model, the discriminator field and value
 * that narrow the root to it, and whether its rows live in the root's table (single-table
 * inheritance) rather than a table of their own. Undefined for a model that is not a variant.
 */
export function variantOf(
  contract: AnyContract,
  modelKey: string,
): { root: string; field: string; value: string; sharesTable: boolean } | undefined {
  const root = rootModelKey(contract, modelKey);
  if (root === modelKey) {
    return undefined;
  }
  const discriminator = modelDiscriminator(contract, root);
  const value = Object.entries(discriminator?.variants ?? {}).find(
    ([, variant]) => relatedModelKey(contract, variant) === modelKey,
  )?.[0];
  if (!discriminator || value === undefined) {
    return undefined;
  }
  const table = (model: string) => {
    const storage = lookupModel(contract, model)?.storage as
      | { table?: string; namespaceId?: string }
      | undefined;
    return storage?.table && `${storage.namespaceId}.${storage.table}`;
  };
  const own = table(modelKey);
  return { root, field: discriminator.field, value, sharesTable: !own || own === table(root) };
}

/**
 * The discriminator value a relation to `targetModel` is narrowed to when its GraphQL type is
 * backed by `typeModel`: a variant of the relation's base target. Undefined when no narrowing
 * applies. A type from the same hierarchy that the relation can't return is a schema error.
 */
export function relationVariant(
  contract: AnyContract,
  owner: string,
  targetModel: string,
  typeModel: string | undefined,
): string | undefined {
  if (typeModel === undefined || typeModel === targetModel) {
    return undefined;
  }
  const variant = variantOf(contract, typeModel);
  if (!variant || variant.root !== rootModelKey(contract, targetModel)) {
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

/**
 * A variant model's collection must be its base narrowed with `.variant()`. The ORM's own
 * `orm.Bug` accessor isn't filtered by the discriminator and can't include inherited relations.
 */
export function assertVariantCollection(
  contract: AnyContract,
  modelKey: string,
  collection: { modelName?: string; state?: { variantValue?: unknown } },
): void {
  const variant = variantOf(contract, modelKey);
  if (variant && collection.state?.variantValue !== variant.value) {
    throw new PothosValidationError(
      `Fields returning variant model '${modelKey}' must return a Collection from orm.${variant.root}.variant('${variant.value}').`,
    );
  }
}

/** The GraphQL name a model's default type takes; `.` isn't valid in one. */
export function defaultTypeName(modelKey: string): string {
  return modelKey.replace('.', '_');
}

/**
 * A model's fallback collection: a `collections` entry under its key, or the model on a namespaced
 * ORM client (`orm.<namespace>.<Model>`), so `collections: (ctx) => ctx.db.orm` works either way.
 */
export function collectionForModel(
  contract: AnyContract,
  collections: object,
  modelKey: string,
): unknown {
  const entries = collections as Record<string, unknown>;
  if (entries[modelKey]) {
    return entries[modelKey];
  }
  const separator = modelKey.indexOf('.');
  const model = separator >= 0 ? modelKey.slice(separator + 1) : modelKey;
  const namespace =
    separator >= 0 ? modelKey.slice(0, separator) : namespacesWithModel(contract, model)[0];
  return namespace
    ? (entries[namespace] as Record<string, unknown> | undefined)?.[model]
    : undefined;
}
