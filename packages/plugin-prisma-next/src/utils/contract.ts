import { PothosSchemaError, PothosValidationError } from '@pothos/core';
import type { SqlModelStorage } from '@prisma/orm-family-sql/contract/types';
import { resolveDomainModel } from '@prisma/orm-framework/contract/resolve-domain-model';
import type { ContractModelBase } from '@prisma/orm-framework/contract/types';
import type { AnyContract } from '../types.js';

export type SqlContractModel = ContractModelBase<SqlModelStorage>;

function namespacesWithModel(contract: AnyContract, model: string): string[] {
  return Object.entries(contract.domain.namespaces)
    .filter(([, namespace]) => Object.hasOwn(namespace.models, model))
    .map(([id]) => id);
}

// Keys are `namespace.Model` for names several namespaces share; `resolveDomainModel` would
// pick the first match.
export function resolveContractModel(
  contract: AnyContract,
  modelKey: string,
): SqlContractModel | undefined {
  const model = lookupModel(contract, modelKey);
  const base = model?.base;
  if (!base) {
    return model;
  }
  // A variant's contract entry holds only its own fields; the rest come from its base.
  const parent = resolveContractModel(contract, relatedModelKey(contract, base))!;
  return {
    ...model!,
    fields: { ...parent.fields, ...model!.fields },
    relations: { ...parent.relations, ...model!.relations },
    storage: parent.storage,
  };
}

export function assertContractModel(contract: AnyContract, modelKey: string): SqlContractModel {
  const model = resolveContractModel(contract, modelKey);
  if (!model) {
    throw new PothosSchemaError(`Model '${modelKey}' not found in the prismaNext contract.`);
  }
  return model;
}

/**
 * The table and column a field is stored in. A variant's merged model carries its base's
 * storage, but the fields it declares live in its own table, under its own column names.
 */
export function fieldStorage(
  contract: AnyContract,
  modelKey: string,
  field: string,
): { namespaceId: string; table: string; column: string } | undefined {
  const model = lookupModel(contract, modelKey);
  const storage = model?.storage;
  if (model?.base && !(Object.hasOwn(model.fields, field) && storage?.table)) {
    return fieldStorage(contract, relatedModelKey(contract, model.base), field);
  }
  return storage?.table && storage.namespaceId
    ? {
        namespaceId: storage.namespaceId,
        table: storage.table,
        column: storage.fields?.[field]?.column ?? field,
      }
    : undefined;
}

function lookupModel(contract: AnyContract, modelKey: string): SqlContractModel | undefined {
  const separator = modelKey.indexOf('.');
  if (separator >= 0) {
    const model = modelKey.slice(separator + 1);
    if (namespacesWithModel(contract, model).length === 1) {
      throw new PothosSchemaError(
        `Model '${modelKey}' is not ambiguous. Use the bare name '${model}'.`,
      );
    }
    return contract.domain.namespaces[modelKey.slice(0, separator)]?.models[model] as
      | SqlContractModel
      | undefined;
  }
  const namespaces = namespacesWithModel(contract, modelKey);
  if (namespaces.length > 1) {
    throw new PothosSchemaError(
      `Model '${modelKey}' exists in namespaces ${namespaces.map((id) => `'${id}'`).join(', ')}. ` +
        `Use a qualified name: ${namespaces.map((id) => `'${id}.${modelKey}'`).join(', ')}.`,
    );
  }
  return resolveDomainModel(contract.domain, modelKey)?.model as SqlContractModel | undefined;
}

export function relatedModelKey(
  contract: AnyContract,
  to: { readonly model: string; readonly namespace: string },
): string {
  return namespacesWithModel(contract, to.model).length > 1
    ? `${to.namespace}.${to.model}`
    : to.model;
}

export function rootModelKey(contract: AnyContract, modelKey: string): string {
  const base = lookupModel(contract, modelKey)?.base;
  return base ? rootModelKey(contract, relatedModelKey(contract, base)) : modelKey;
}

export function modelDiscriminator(contract: AnyContract, modelKey: string) {
  const model = lookupModel(contract, modelKey);
  return model?.discriminator && model.variants
    ? { field: model.discriminator.field, variants: model.variants }
    : undefined;
}

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
    const storage = lookupModel(contract, model)?.storage;
    return storage?.table && `${storage.namespaceId}.${storage.table}`;
  };
  const own = table(modelKey);
  return { root, field: discriminator.field, value, sharesTable: !own || own === table(root) };
}

/**
 * The variant a relation is narrowed to when its GraphQL type is backed by a variant of its
 * target. Throws for a type from the hierarchy the relation can't return.
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

// The ORM's `orm.Bug` isn't filtered by the discriminator and can't include inherited relations.
export function assertVariantCollection(
  contract: AnyContract,
  modelKey: string,
  collection: { modelName?: string; namespaceId?: string; state?: { variantValue?: unknown } },
): void {
  const { modelName, namespaceId } = collection;
  if (
    modelName !== undefined &&
    namespaceId !== undefined &&
    rootModelKey(
      contract,
      relatedModelKey(contract, { model: modelName, namespace: namespaceId }),
    ) !== rootModelKey(contract, modelKey)
  ) {
    throw new PothosValidationError(
      `Fields returning model '${modelKey}' must return a Collection of that model, not orm.${modelName}.`,
    );
  }
  const variant = variantOf(contract, modelKey);
  if (variant && collection.state?.variantValue !== variant.value) {
    throw new PothosValidationError(
      `Fields returning variant model '${modelKey}' must return a Collection from orm.${variant.root}.variant('${variant.value}').`,
    );
  }
}

export function defaultTypeName(modelKey: string): string {
  return modelKey.replace('.', '_');
}

/** Looks up the model key, then `<namespace>.<Model>`, so a namespaced ORM client works as is. */
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
