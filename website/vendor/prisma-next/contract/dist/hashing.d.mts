import { d as ExecutionHashBase, t as Contract, w as StorageHashBase, x as ProfileHashBase } from "./contract-types-DULFYxpd.mjs";

//#region src/canonicalization.d.ts
declare function canonicalizeContractToObject(contract: Contract, options?: {
  schemaVersion?: string;
}): Record<string, unknown>;
declare function canonicalizeContract(contract: Contract, options?: {
  schemaVersion?: string;
}): string;
//#endregion
//#region src/hashing.d.ts
declare function computeStorageHash(args: {
  target: string;
  targetFamily: string;
  storage: Record<string, unknown>;
}): StorageHashBase<string>;
declare function computeExecutionHash(args: {
  target: string;
  targetFamily: string;
  execution: Record<string, unknown>;
}): ExecutionHashBase<string>;
declare function computeProfileHash(args: {
  target: string;
  targetFamily: string;
  capabilities: Record<string, Record<string, boolean>>;
}): ProfileHashBase<string>;
//#endregion
export { canonicalizeContract, canonicalizeContractToObject, computeExecutionHash, computeProfileHash, computeStorageHash };
//# sourceMappingURL=hashing.d.mts.map