//#region src/domain-types.d.ts
type ScalarFieldType = {
  readonly kind: 'scalar';
  readonly codecId: string;
  readonly typeParams?: Record<string, unknown>;
};
type ValueObjectFieldType = {
  readonly kind: 'valueObject';
  readonly name: string;
};
type UnionFieldType = {
  readonly kind: 'union';
  readonly members: ReadonlyArray<ScalarFieldType | ValueObjectFieldType>;
};
type ContractFieldType = ScalarFieldType | ValueObjectFieldType | UnionFieldType;
type ContractField = {
  readonly nullable: boolean;
  readonly type: ContractFieldType;
  readonly many?: true;
  readonly dict?: true;
};
type ContractRelationOn = {
  readonly localFields: readonly string[];
  readonly targetFields: readonly string[];
};
type ContractReferenceRelation = {
  readonly to: string;
  readonly cardinality: '1:1' | '1:N' | 'N:1';
  readonly on: ContractRelationOn;
};
type ContractEmbedRelation = {
  readonly to: string;
  readonly cardinality: '1:1' | '1:N';
};
type ContractRelation = ContractReferenceRelation | ContractEmbedRelation;
type ContractDiscriminator = {
  readonly field: string;
};
type ContractVariantEntry = {
  readonly value: string;
};
type ContractValueObject = {
  readonly fields: Record<string, ContractField>;
};
type ModelStorageBase = Readonly<Record<string, unknown>>;
interface ContractModelBase<TModelStorage extends ModelStorageBase = ModelStorageBase> {
  readonly fields: Record<string, ContractField>;
  readonly relations: Record<string, ContractRelation>;
  readonly storage: TModelStorage;
  readonly discriminator?: ContractDiscriminator;
  readonly variants?: Record<string, ContractVariantEntry>;
  readonly base?: string;
  readonly owner?: string;
}
interface ContractModel<TModelStorage extends ModelStorageBase = ModelStorageBase> extends ContractModelBase<TModelStorage> {
  readonly fields: Record<string, ContractField>;
}
type HasModelsWithRelations = {
  readonly models: Record<string, {
    readonly relations: Record<string, ContractRelation>;
  }>;
};
type ReferenceRelationKeys<TContract extends HasModelsWithRelations, ModelName extends string & keyof TContract['models']> = { [K in keyof TContract['models'][ModelName]['relations']]: TContract['models'][ModelName]['relations'][K] extends ContractReferenceRelation ? K : never }[keyof TContract['models'][ModelName]['relations']];
type EmbedRelationKeys<TContract extends HasModelsWithRelations, ModelName extends string & keyof TContract['models']> = { [K in keyof TContract['models'][ModelName]['relations']]: TContract['models'][ModelName]['relations'][K] extends ContractReferenceRelation ? never : K }[keyof TContract['models'][ModelName]['relations']];
//#endregion
//#region src/types.d.ts
/**
 * Unique symbol used as the key for branding types.
 */
declare const $: unique symbol;
/**
 * A helper type to brand a given type with a unique identifier.
 *
 * @template TKey Text used as the brand key.
 * @template TValue Optional value associated with the brand key. Defaults to `true`.
 */
type Brand<TKey extends string | number | symbol, TValue = true> = {
  [$]: { [K in TKey]: TValue };
};
/**
 * Base type for storage contract hashes.
 * Emitted contract.d.ts files use this with the hash value as a type parameter:
 * `type StorageHash = StorageHashBase<'sha256:abc123...'>`
 */
type StorageHashBase<THash extends string> = THash & Brand<'StorageHash'>;
/**
 * Base type for execution contract hashes.
 * Emitted contract.d.ts files use this with the hash value as a type parameter:
 * `type ExecutionHash = ExecutionHashBase<'sha256:def456...'>`
 */
type ExecutionHashBase<THash extends string> = THash & Brand<'ExecutionHash'>;
declare function executionHash<const T extends string>(value: T): ExecutionHashBase<T>;
declare function coreHash<const T extends string>(value: T): StorageHashBase<T>;
/**
 * Base type for profile contract hashes.
 * Emitted contract.d.ts files use this with the hash value as a type parameter:
 * `type ProfileHash = ProfileHashBase<'sha256:def456...'>`
 */
type ProfileHashBase<THash extends string> = THash & Brand<'ProfileHash'>;
declare function profileHash<const T extends string>(value: T): ProfileHashBase<T>;
/**
 * Base type for family-specific storage blocks.
 * Family storage types (SqlStorage, MongoStorage, etc.) extend this to carry the
 * storage hash alongside family-specific data (tables, collections, etc.).
 */
interface StorageBase<THash extends string = string> {
  readonly storageHash: StorageHashBase<THash>;
}
interface FieldType {
  readonly type: string;
  readonly nullable: boolean;
  readonly items?: FieldType;
  readonly properties?: Record<string, FieldType>;
}
type GeneratedValueSpec = {
  readonly id: string;
  readonly params?: Record<string, unknown>;
};
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | {
  readonly [key: string]: JsonValue;
} | readonly JsonValue[];
type ColumnDefaultLiteralValue = JsonValue;
type ColumnDefaultLiteralInputValue = ColumnDefaultLiteralValue | Date;
type ColumnDefault = {
  readonly kind: 'literal';
  readonly value: ColumnDefaultLiteralInputValue;
} | {
  readonly kind: 'function';
  readonly expression: string;
};
type ExecutionMutationDefaultValue = {
  readonly kind: 'generator';
  readonly id: GeneratedValueSpec['id'];
  readonly params?: Record<string, unknown>;
};
type ExecutionMutationDefault = {
  readonly ref: {
    readonly table: string;
    readonly column: string;
  };
  readonly onCreate?: ExecutionMutationDefaultValue;
  readonly onUpdate?: ExecutionMutationDefaultValue;
};
type ExecutionSection<THash extends string = string> = {
  readonly executionHash: ExecutionHashBase<THash>;
  readonly mutations: {
    readonly defaults: ReadonlyArray<ExecutionMutationDefault>;
  };
};
interface Source {
  readonly readOnly: boolean;
  readonly projection: Record<string, FieldType>;
  readonly origin?: Record<string, unknown>;
  readonly capabilities?: Record<string, boolean>;
}
interface DocIndex {
  readonly name: string;
  readonly keys: Record<string, 'asc' | 'desc'>;
  readonly unique?: boolean;
  readonly where?: Expr;
}
type Expr = {
  readonly kind: 'eq';
  readonly path: ReadonlyArray<string>;
  readonly value: unknown;
} | {
  readonly kind: 'exists';
  readonly path: ReadonlyArray<string>;
};
interface DocCollection {
  readonly name: string;
  readonly id?: {
    readonly strategy: 'auto' | 'client' | 'uuid' | 'objectId';
  };
  readonly fields: Record<string, FieldType>;
  readonly indexes?: ReadonlyArray<DocIndex>;
  readonly readOnly?: boolean;
}
interface PlanMeta {
  readonly target: string;
  readonly targetFamily?: string;
  readonly storageHash: string;
  readonly profileHash?: string;
  readonly lane: string;
  readonly annotations?: {
    readonly [key: string]: unknown;
  };
}
/**
 * Contract marker record stored in the database.
 * Represents the current contract identity for a database.
 */
interface ContractMarkerRecord {
  readonly storageHash: string;
  readonly profileHash: string;
  readonly contractJson: unknown | null;
  readonly canonicalVersion: number | null;
  readonly updatedAt: Date;
  readonly appTag: string | null;
  readonly meta: Record<string, unknown>;
  readonly invariants: readonly string[];
}
//#endregion
//#region src/contract-types.d.ts
/**
 * Execution section for the unified contract (ADR 182).
 *
 * Unlike the legacy {@link import('./types').ExecutionSection}, this type
 * requires `executionHash` — when an execution section is present, its
 * hash must be too (consistent with `StorageBase.storageHash`).
 *
 * @template THash  Literal hash string type for type-safe hash tracking.
 */
type ContractExecutionSection<THash extends string = string> = {
  readonly executionHash: ExecutionHashBase<THash>;
  readonly mutations: {
    readonly defaults: ReadonlyArray<ExecutionMutationDefault>;
  };
};
/**
 * Unified contract representation (ADR 182).
 *
 * A `Contract` is the canonical in-memory representation of a data contract.
 * It is model-first (domain models carry their own storage bridge) and
 * family-parameterized (SQL, Mongo, etc. specialize via `TStorage` and model
 * storage generics on `ContractModel`).
 *
 * JSON persistence fields (`schemaVersion`, `sources`) are not represented
 * here — they are handled at the serialization boundary.
 *
 * @template TStorage  Family-specific storage block (extends {@link StorageBase}).
 * @template TModels   Record of model name → {@link ContractModel} with
 *                     family-specific model storage.
 */
interface Contract<TStorage extends StorageBase = StorageBase, TModels extends Record<string, ContractModelBase> = Record<string, ContractModelBase>> {
  readonly target: string;
  readonly targetFamily: string;
  readonly roots: Record<string, string>;
  readonly models: TModels;
  readonly valueObjects?: Record<string, ContractValueObject>;
  readonly storage: TStorage;
  readonly capabilities: Record<string, Record<string, boolean>>;
  readonly extensionPacks: Record<string, unknown>;
  readonly execution?: ContractExecutionSection;
  readonly profileHash: ProfileHashBase<string>;
  readonly meta: Record<string, unknown>;
}
//#endregion
export { ContractField as A, ModelStorageBase as B, StorageBase as C, profileHash as D, executionHash as E, ContractRelation as F, ScalarFieldType as H, ContractRelationOn as I, ContractValueObject as L, ContractModel as M, ContractModelBase as N, ContractDiscriminator as O, ContractReferenceRelation as P, ContractVariantEntry as R, Source as S, coreHash as T, UnionFieldType as U, ReferenceRelationKeys as V, ValueObjectFieldType as W, GeneratedValueSpec as _, ColumnDefault as a, PlanMeta as b, ContractMarkerRecord as c, ExecutionHashBase as d, ExecutionMutationDefault as f, FieldType as g, Expr as h, Brand as i, ContractFieldType as j, ContractEmbedRelation as k, DocCollection as l, ExecutionSection as m, ContractExecutionSection as n, ColumnDefaultLiteralInputValue as o, ExecutionMutationDefaultValue as p, $ as r, ColumnDefaultLiteralValue as s, Contract as t, DocIndex as u, JsonPrimitive as v, StorageHashBase as w, ProfileHashBase as x, JsonValue as y, EmbedRelationKeys as z };
//# sourceMappingURL=contract-types-DULFYxpd.d.mts.map