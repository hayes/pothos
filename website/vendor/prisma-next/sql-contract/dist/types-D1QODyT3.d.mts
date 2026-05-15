import { ColumnDefault, StorageBase } from "@prisma-next/contract/types";
import { CodecTrait } from "@prisma-next/framework-components/codec";

//#region src/types.d.ts

/**
 * A column definition in storage.
 *
 * `typeParams` is optional because most columns use non-parameterized types.
 * Columns with parameterized types can either inline `typeParams` or reference
 * a named {@link StorageTypeInstance} via `typeRef`.
 */
type StorageColumn = {
  readonly nativeType: string;
  readonly codecId: string;
  readonly nullable: boolean;
  /**
   * Opaque, codec-owned JS/type parameters.
   * The codec that owns `codecId` defines the shape and semantics.
   * Mutually exclusive with `typeRef`.
   */
  readonly typeParams?: Record<string, unknown>;
  /**
   * Reference to a named type instance in `storage.types`.
   * Mutually exclusive with `typeParams`.
   */
  readonly typeRef?: string;
  /**
   * Default value for the column.
   * Can be a literal value or database function.
   */
  readonly default?: ColumnDefault;
};
type PrimaryKey = {
  readonly columns: readonly string[];
  readonly name?: string;
};
type UniqueConstraint = {
  readonly columns: readonly string[];
  readonly name?: string;
};
type Index = {
  readonly columns: readonly string[];
  readonly name?: string;
  /**
   * Optional access method identifier.
   * Extension-specific methods are represented as strings and interpreted
   * by the owning extension package.
   */
  readonly using?: string;
  /**
   * Optional extension-owned index configuration payload.
   */
  readonly config?: Record<string, unknown>;
};
type ForeignKeyReferences = {
  readonly table: string;
  readonly columns: readonly string[];
};
type ReferentialAction = 'noAction' | 'restrict' | 'cascade' | 'setNull' | 'setDefault';
type ForeignKeyOptions = {
  readonly name?: string;
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
};
type ForeignKey = {
  readonly columns: readonly string[];
  readonly references: ForeignKeyReferences;
  readonly name?: string;
  readonly onDelete?: ReferentialAction;
  readonly onUpdate?: ReferentialAction;
  /** Whether to emit FK constraint DDL (ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY). */
  readonly constraint: boolean;
  /** Whether to emit a backing index for the FK columns. */
  readonly index: boolean;
};
type StorageTable = {
  readonly columns: Record<string, StorageColumn>;
  readonly primaryKey?: PrimaryKey;
  readonly uniques: ReadonlyArray<UniqueConstraint>;
  readonly indexes: ReadonlyArray<Index>;
  readonly foreignKeys: ReadonlyArray<ForeignKey>;
};
/**
 * A named, parameterized type instance.
 * These are registered in `storage.types` for reuse across columns
 * and to enable ergonomic schema surfaces like `schema.types.MyType`.
 *
 * Unlike {@link StorageColumn}, `typeParams` is required here because
 * `StorageTypeInstance` exists specifically to define reusable parameterized types.
 * A type instance without parameters would be redundant—columns can reference
 * the codec directly via `codecId`.
 */
type StorageTypeInstance = {
  readonly codecId: string;
  readonly nativeType: string;
  readonly typeParams: Record<string, unknown>;
};
type SqlStorage<THash extends string = string> = StorageBase<THash> & {
  readonly tables: Record<string, StorageTable>;
  /**
   * Named type instances for parameterized/custom types.
   * Columns can reference these via `typeRef`.
   */
  readonly types?: Record<string, StorageTypeInstance>;
};
type SqlModelFieldStorage = {
  readonly column: string;
  readonly codecId?: string;
  readonly nullable?: boolean;
};
type SqlModelStorage = {
  readonly table: string;
  readonly fields: Record<string, SqlModelFieldStorage>;
};
declare const DEFAULT_FK_CONSTRAINT = true;
declare const DEFAULT_FK_INDEX = true;
declare function applyFkDefaults(fk: {
  constraint?: boolean | undefined;
  index?: boolean | undefined;
}, overrideDefaults?: {
  constraint?: boolean | undefined;
  index?: boolean | undefined;
}): {
  constraint: boolean;
  index: boolean;
};
type TypeMaps<TCodecTypes extends Record<string, {
  output: unknown;
}> = Record<string, never>, TOperationTypes extends Record<string, unknown> = Record<string, never>, TQueryOperationTypes extends Record<string, unknown> = Record<string, never>, TFieldOutputTypes extends Record<string, Record<string, unknown>> = Record<string, never>, TFieldInputTypes extends Record<string, Record<string, unknown>> = Record<string, never>> = {
  readonly codecTypes: TCodecTypes;
  readonly operationTypes: TOperationTypes;
  readonly queryOperationTypes: TQueryOperationTypes;
  readonly fieldOutputTypes: TFieldOutputTypes;
  readonly fieldInputTypes: TFieldInputTypes;
};
type CodecTypesOf<T> = [T] extends [never] ? Record<string, never> : T extends {
  readonly codecTypes: infer C;
} ? C extends Record<string, {
  output: unknown;
}> ? C : Record<string, never> : Record<string, never>;
type OperationTypesOf<T> = [T] extends [never] ? Record<string, never> : T extends {
  readonly operationTypes: infer O;
} ? O extends Record<string, unknown> ? O : Record<string, never> : Record<string, never>;
/**
 * Dispatch hint identifying the first-argument target of an operation.
 *
 * Used by ORM column helpers to decide whether an operation is reachable on a
 * field. Either names a concrete codec identity or a set of capability traits
 * that the field's codec must carry.
 */
type QueryOperationSelfSpec = {
  readonly codecId: string;
  readonly traits?: never;
} | {
  readonly traits: readonly CodecTrait[];
  readonly codecId?: never;
};
/**
 * Structural shape an operation's impl must return: any value carrying a
 * codec-exact `returnType` descriptor. `Expression<T>` (from
 * `@prisma-next/sql-relational-core/expression`, with `T extends ScopeField`)
 * extends this. Trait-targeted returns are deliberately excluded — predicate
 * detection and result decoding both depend on knowing the concrete return
 * codec.
 */
type QueryOperationReturn = {
  readonly returnType: {
    readonly codecId: string;
    readonly nullable: boolean;
  };
};
type QueryOperationTypeEntry = {
  readonly self?: QueryOperationSelfSpec;
  readonly impl: (...args: never[]) => QueryOperationReturn;
};
type SqlQueryOperationTypes<_CT extends Record<string, {
  readonly input: unknown;
  readonly output: unknown;
}>, T extends Record<string, QueryOperationTypeEntry>> = T;
type QueryOperationTypesBase = Record<string, QueryOperationTypeEntry>;
type QueryOperationTypesOf<T> = [T] extends [never] ? Record<string, never> : T extends {
  readonly queryOperationTypes: infer Q;
} ? Q extends Record<string, unknown> ? Q : Record<string, never> : Record<string, never>;
type TypeMapsPhantomKey = '__@prisma-next/sql-contract/typeMaps@__';
type ContractWithTypeMaps<TContract, TTypeMaps> = TContract & { readonly [K in TypeMapsPhantomKey]?: TTypeMaps };
type ExtractTypeMapsFromContract<T> = TypeMapsPhantomKey extends keyof T ? NonNullable<T[TypeMapsPhantomKey & keyof T]> : never;
type FieldOutputTypesOf<T> = [T] extends [never] ? Record<string, never> : T extends {
  readonly fieldOutputTypes: infer F;
} ? F extends Record<string, Record<string, unknown>> ? F : Record<string, never> : Record<string, never>;
type FieldInputTypesOf<T> = [T] extends [never] ? Record<string, never> : T extends {
  readonly fieldInputTypes: infer F;
} ? F extends Record<string, Record<string, unknown>> ? F : Record<string, never> : Record<string, never>;
type ExtractCodecTypes<T> = CodecTypesOf<ExtractTypeMapsFromContract<T>>;
type ExtractQueryOperationTypes<T> = QueryOperationTypesOf<ExtractTypeMapsFromContract<T>>;
type ExtractFieldOutputTypes<T> = FieldOutputTypesOf<ExtractTypeMapsFromContract<T>>;
type ExtractFieldInputTypes<T> = FieldInputTypesOf<ExtractTypeMapsFromContract<T>>;
type ResolveCodecTypes<TContract, TTypeMaps> = [TTypeMaps] extends [never] ? ExtractCodecTypes<TContract> : CodecTypesOf<TTypeMaps>;
type ResolveOperationTypes<_TContract, TTypeMaps> = OperationTypesOf<TTypeMaps>;
//#endregion
export { StorageColumn as A, ReferentialAction as C, SqlModelStorage as D, SqlModelFieldStorage as E, UniqueConstraint as F, applyFkDefaults as I, StorageTypeInstance as M, TypeMaps as N, SqlQueryOperationTypes as O, TypeMapsPhantomKey as P, QueryOperationTypesOf as S, ResolveOperationTypes as T, PrimaryKey as _, ExtractCodecTypes as a, QueryOperationTypeEntry as b, ExtractQueryOperationTypes as c, FieldOutputTypesOf as d, ForeignKey as f, OperationTypesOf as g, Index as h, DEFAULT_FK_INDEX as i, StorageTable as j, SqlStorage as k, ExtractTypeMapsFromContract as l, ForeignKeyReferences as m, ContractWithTypeMaps as n, ExtractFieldInputTypes as o, ForeignKeyOptions as p, DEFAULT_FK_CONSTRAINT as r, ExtractFieldOutputTypes as s, CodecTypesOf as t, FieldInputTypesOf as u, QueryOperationReturn as v, ResolveCodecTypes as w, QueryOperationTypesBase as x, QueryOperationSelfSpec as y };
//# sourceMappingURL=types-D1QODyT3.d.mts.map