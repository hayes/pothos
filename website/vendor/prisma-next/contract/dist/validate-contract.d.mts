import { t as Contract } from "./contract-types-DULFYxpd.mjs";

//#region src/validate-contract.d.ts
type ContractValidationPhase = 'structural' | 'domain' | 'storage';
declare class ContractValidationError extends Error {
  readonly code = "CONTRACT.VALIDATION_FAILED";
  readonly phase: ContractValidationPhase;
  constructor(message: string, phase: ContractValidationPhase);
}
/**
 * Family-provided storage validator.
 * SQL validates tables/columns/FKs; Mongo validates collections/embedding.
 */
type StorageValidator = (contract: Contract) => void;
/**
 * Framework-level contract validation (ADR 182).
 *
 * Three-pass validation:
 * 1. **Structural validation** (arktype): verifies required fields exist with
 *    correct base types.
 * 2. **Domain validation** (framework-owned): roots, relation targets,
 *    variant/base consistency, discriminators, ownership, orphans.
 * 3. **Storage validation** (family-provided): SQL validates tables/columns/FKs;
 *    Mongo validates collections/embedding.
 *
 * JSON persistence fields (`schemaVersion`, `_generated`) are stripped before
 * validation — they are not part of the in-memory contract representation.
 *
 * @template TContract  The fully-typed contract type (preserves literal types).
 * @param value           Raw contract value (e.g. parsed from JSON).
 * @param storageValidator  Family-specific storage validation function.
 * @returns The validated contract with full literal types.
 */
declare function validateContract<TContract extends Contract>(value: unknown, storageValidator: StorageValidator): TContract;
//#endregion
export { ContractValidationError, type ContractValidationPhase, type StorageValidator, validateContract };
//# sourceMappingURL=validate-contract.d.mts.map