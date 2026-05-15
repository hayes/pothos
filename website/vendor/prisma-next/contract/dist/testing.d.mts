import { B as ModelStorageBase, C as StorageBase, L as ContractValueObject, M as ContractModel, N as ContractModelBase, m as ExecutionSection, t as Contract, w as StorageHashBase, x as ProfileHashBase } from "./contract-types-DULFYxpd.mjs";

//#region src/testing-factories.d.ts
type ContractOverrides<TStorage extends StorageBase = StorageBase, TModels extends Record<string, ContractModelBase> = Record<string, ContractModel>> = {
  target?: string;
  targetFamily?: string;
  roots?: Record<string, string>;
  models?: TModels;
  storage?: Omit<TStorage, 'storageHash'>;
  valueObjects?: Record<string, ContractValueObject>;
  capabilities?: Record<string, Record<string, boolean>>;
  extensionPacks?: Record<string, unknown>;
  execution?: Omit<ExecutionSection, 'executionHash'>;
  profileHash?: ProfileHashBase<string>;
  meta?: Record<string, unknown>;
};
declare const DUMMY_HASH: StorageHashBase<"sha256:test">;
declare function createContract<TStorage extends StorageBase = StorageBase, TModels extends Record<string, ContractModelBase> = Record<string, ContractModel>>(overrides?: ContractOverrides<TStorage, TModels>): Contract<TStorage, TModels>;
type SqlStorageLike = StorageBase & {
  readonly tables: Record<string, unknown>;
  readonly types?: Record<string, unknown>;
};
type SqlModelLike = ContractModel<ModelStorageBase & {
  table: string;
}>;
declare function createSqlContract(overrides?: ContractOverrides<SqlStorageLike, Record<string, SqlModelLike>>): Contract<SqlStorageLike, Record<string, SqlModelLike>>;
//#endregion
export { DUMMY_HASH, createContract, createSqlContract };
//# sourceMappingURL=testing.d.mts.map