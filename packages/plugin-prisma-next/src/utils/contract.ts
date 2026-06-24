import { resolveDomainModel } from '@prisma-next/contract/resolve-domain-model';
import type { ContractModelBase } from '@prisma-next/contract/types';
import type { AnyContract } from '../types';

/**
 * Resolve a model definition by name, delegating to prisma-next's own
 * `resolveDomainModel`. ADR 221 moved model defs from a flat `contract.models`
 * map to `contract.domain.namespaces.<nsId>.models`; reusing the library's
 * resolver means the plugin inherits its namespace handling — including the
 * cross-namespace bare-name collision rules (TML-2550) — instead of forking a
 * parallel scan. Mirrors the type-level `ModelDefOf` in `../types`.
 */
export function resolveContractModel(
  contract: AnyContract,
  modelName: string,
): ContractModelBase | undefined {
  return resolveDomainModel(contract.domain, modelName)?.model;
}
