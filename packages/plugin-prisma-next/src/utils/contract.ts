import { PothosSchemaError } from '@pothos/core';
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
