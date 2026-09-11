import { resolveDomainModel } from '@prisma-next/contract/resolve-domain-model';
import type { ContractModelBase } from '@prisma-next/contract/types';
import type { AnyContract } from '../types.js';

/**
 * Resolve a model definition by name, delegating to prisma-next's own
 * `resolveDomainModel`. Model defs live under
 * `contract.domain.namespaces.<nsId>.models`, so reusing the library's resolver
 * means the plugin inherits its namespace handling — including the rules for a
 * bare name that collides across namespaces — instead of forking a parallel
 * scan. Mirrors the type-level `ModelDefOf` in `../types`.
 */
export function resolveContractModel(
  contract: AnyContract,
  modelName: string,
): ContractModelBase | undefined {
  return resolveDomainModel(contract.domain, modelName)?.model;
}
