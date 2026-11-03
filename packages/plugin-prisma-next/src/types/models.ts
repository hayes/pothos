import type { Merge, SchemaTypes } from '@pothos/core';
import type { SqlStorage } from '@prisma/orm-family-sql/contract/types';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import type { Contract } from '@prisma/orm-framework/contract/types';
import type { ModelBrand, PlannedRowBrand, prismaModelBrand } from '../object-ref.js';
import type { IsToMany } from './relations.js';

export type AnyContract = Contract<SqlStorage>;

// Mirrors orm-client's internal `ScannedModelDef`.
type ModelDefOf<
  TContract extends AnyContract,
  M extends string,
> = M extends `${infer Ns}.${infer Bare}`
  ? TContract['domain']['namespaces'][Ns]['models'][Bare]
  : {
      [Ns in keyof TContract['domain']['namespaces']]: M extends keyof TContract['domain']['namespaces'][Ns]['models']
        ? TContract['domain']['namespaces'][Ns]['models'][M]
        : never;
    }[keyof TContract['domain']['namespaces']];

/** A model key is a bare name, or `namespace.Model` in a contract with several namespaces. */
export type BareModelName<M extends string> = M extends `${string}.${infer Bare}` ? Bare : M;

type NamespaceIds<TContract extends AnyContract> = keyof TContract['domain']['namespaces'] & string;

export type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/**
 * A model's key: `namespace.Model` when the contract has several namespaces, and the bare
 * model name when it has one. `Ns` may be a branded id.
 */
export type NamespacedModelKey<TContract extends AnyContract, Ns extends string, M extends string> =
  IsUnion<NamespaceIds<TContract>> extends true
    ? `${{
        [Key in NamespaceIds<TContract>]: Ns extends Key ? Key : never;
      }[NamespaceIds<TContract>]}.${M}`
    : M;

/** A variant's base model, or `never` for models that aren't variants. */
export type BaseModelKey<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends {
    readonly base: {
      readonly model: infer Base extends string;
      readonly namespace: infer Ns extends string;
    };
  }
    ? NamespacedModelKey<TContract, Ns, Base>
    : never;

export type ModelKeys<TContract extends AnyContract> = {
  [Ns in NamespaceIds<TContract>]: {
    [M in keyof TContract['domain']['namespaces'][Ns]['models'] & string]: NamespacedModelKey<
      TContract,
      Ns,
      M
    >;
  }[keyof TContract['domain']['namespaces'][Ns]['models'] & string];
}[NamespaceIds<TContract>];

// Upstream's `RelationsOf` collapses to `Record<string, never>` in generic positions, so relations
// are read from the model def. A model without relations emits `Record<string, never>`, whose index
// signature would make every string a relation key, so it is dropped.
export type OwnRelationsOfModel<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends {
    readonly relations: infer Rels extends Record<string, unknown>;
  }
    ? string extends keyof Rels
      ? [Rels[string]] extends [never]
        ? {}
        : Rels
      : Rels
    : {};

export type RelationsOfModel<TContract extends AnyContract, M extends string> = [
  BaseModelKey<TContract, M>,
] extends [never]
  ? OwnRelationsOfModel<TContract, M>
  : OwnRelationsOfModel<TContract, M> & OwnRelationsOfModel<TContract, BaseModelKey<TContract, M>>;

// Without a `PrismaNextContract`, model names would widen to `string`. The sentinel points
// autocomplete at the missing setup instead.
type ModelKeySentinel =
  'Set PrismaNextContract on SchemaTypes: new SchemaBuilder<{ PrismaNextContract: typeof contract }>(...)';

export type ModelKey<Types extends SchemaTypes> = Types['PrismaNextContract'] extends AnyContract
  ? ModelKeys<Types['PrismaNextContract']> extends infer N extends string
    ? string extends N
      ? ModelKeySentinel
      : N
    : ModelKeySentinel
  : ModelKeySentinel;

/**
 * The row of a model's own fields, as the ORM client returns it, such as the rows of a relation
 * loaded with `select: { posts: true }`. A variant's `Row` also has its base's fields.
 */
export type OwnRow<TContract extends AnyContract, M extends ModelKeys<TContract>> = DefaultModelRow<
  TContract,
  BareModelName<M>,
  NamespaceOf<TContract, M>
>;

/** A model's row. A variant's also has its base's fields. */
export type Row<Types extends SchemaTypes, M extends ModelKey<Types>> = [
  BaseModelKey<Types['PrismaNextContract'], M>,
] extends [never]
  ? OwnRow<Types['PrismaNextContract'], M>
  : OwnRow<Types['PrismaNextContract'], M> &
      OwnRow<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>;

export type VariantModelKeys<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, M> extends { readonly variants: infer Variants }
    ? {
        [Value in keyof Variants]: Variants[Value] extends {
          readonly model: infer Variant extends string;
          readonly namespace: infer Ns extends string;
        }
          ? NamespacedModelKey<TContract, Ns, Variant>
          : never;
      }[keyof Variants]
    : never;

/** The key of the variant model of base model `M` whose discriminator value is `Value`. */
export type VariantModelKeyOf<TContract extends AnyContract, M extends string, Value> =
  ModelDefOf<TContract, M> extends { readonly variants: infer Variants }
    ? Value extends keyof Variants
      ? Variants[Value] extends {
          readonly model: infer Variant extends string;
          readonly namespace: infer Ns extends string;
        }
        ? NamespacedModelKey<TContract, Ns, Variant>
        : never
      : never
    : never;

export type VariantValue<TContract extends AnyContract, M extends string> =
  ModelDefOf<TContract, BaseModelKey<TContract, M>> extends {
    readonly variants: infer Variants;
  }
    ? {
        [Value in keyof Variants]: Variants[Value] extends { readonly model: BareModelName<M> }
          ? Value
          : never;
      }[keyof Variants]
    : never;

/** The namespace of a model key: its prefix, or the contract's one namespace. */
export type NamespaceOf<
  TContract extends AnyContract,
  M extends string,
> = M extends `${infer Ns}.${string}` ? Ns : NamespaceIds<TContract>;

/** Upstream's `RelationNames` omits the relations a variant inherits from its base. */
export type RelationKeys<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
> = keyof RelationsOfModel<Types['PrismaNextContract'], M> & string;

/** A model's fields, its table entry, and the storage column each field maps to. */
type ModelTable<C extends AnyContract, M extends string> =
  ModelDefOf<C, M> extends {
    readonly fields: infer Fields;
    readonly storage: {
      readonly namespaceId: infer Ns extends keyof C['storage']['namespaces'];
      readonly table: infer Table extends string;
      readonly fields: infer StorageFields;
    };
  }
    ? C['storage']['namespaces'][Ns]['entries']['table'] extends infer Tables
      ? Table extends keyof Tables
        ? {
            readonly fields: Fields;
            readonly table: Tables[Table];
            readonly storageFields: StorageFields;
          }
        : never
      : never
    : never;

/** The fields mapped to a model's primary key columns, or `never` when its table has none. */
type PrimaryKeyFields<C extends AnyContract, M extends string> =
  ModelTable<C, M> extends {
    readonly table: {
      readonly primaryKey: { readonly columns: infer Columns extends readonly string[] };
    };
    readonly storageFields: infer Storage;
  }
    ? {
        [F in keyof Storage]: Storage[F] extends { readonly column: Columns[number] } ? F : never;
      }[keyof Storage] &
        string
    : never;

/** The key the loader reloads a model's rows by. A variant shares its base's key. */
export type IdentityFields<Types extends SchemaTypes, M extends ModelKey<Types>> = [
  PrimaryKeyFields<Types['PrismaNextContract'], M>,
] extends [never]
  ? PrimaryKeyFields<Types['PrismaNextContract'], BaseModelKey<Types['PrismaNextContract'], M>>
  : PrimaryKeyFields<Types['PrismaNextContract'], M>;

/**
 * A row the loader planned from a query, such as a row connection helpers load with `info`: its key
 * and what the query's selection needs, which includes the `select` of the type it resolves as. A
 * model without an identity loads its whole row. The type-only brand keeps a hand-built row, which
 * may lack what a type's `select` needs, from passing as one.
 */
export type PlannedRow<Types extends SchemaTypes, M extends ModelKey<Types>> = ([
  IdentityFields<Types, M>,
] extends [never]
  ? Row<Types, M>
  : Pick<Row<Types, M>, IdentityFields<Types, M> & keyof Row<Types, M>> & Partial<Row<Types, M>>) &
  PlannedRowBrand<M>;

/** A model's to-one relations. */
export type ToOneRelationKeys<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  [R in RelationKeys<Types, M>]: IsToMany<Types, M, R> extends true ? never : R;
}[RelationKeys<Types, M>];

/** What a returned row keeps of a type's shape: the brand, the columns and the to-one relations. */
type ReturnedKeys<Types extends SchemaTypes, M extends ModelKey<Types>> =
  | typeof prismaModelBrand
  | (keyof Row<Types, M> & string)
  | ToOneRelationKeys<Types, M>;

/**
 * A row built outside the loader that a type of model `M` accepts: its key and what its `Shape`
 * holds other than to-many relations and computed values. A model without an identity needs its
 * whole row.
 */
type BuiltReturnShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Shape,
> = Shape extends unknown
  ? [IdentityFields<Types, M>] extends [never]
    ? Row<Types, M> & Pick<Shape, ToOneRelationKeys<Types, M> & keyof Shape>
    : Pick<Shape, ReturnedKeys<Types, M> & keyof Shape>
  : never;

/**
 * A row the loader planned that a type of model `M` accepts: one of `M` or of a variant of `M`,
 * whose rows hold `M`'s fields. It is matched by its brand alone, so that tsc names the keys a row
 * lacks rather than the brand when a row fits neither this nor `BuiltReturnShape`.
 */
type PlannedReturnShape<Types extends SchemaTypes, M extends ModelKey<Types>> = PlannedRowBrand<
  M | VariantModelKeys<Types['PrismaNextContract'], M>
> &
  ModelBrand<M>;

/**
 * What a field returning a type of model `M` may resolve to, given the type's `Shape`: its key and
 * everything its `select` and its interfaces' `select`s load, other than to-many relations and
 * computed values, which the loader reloads. A model without an identity can't be reloaded, so it
 * needs its whole row. A row the loader planned for `M` or one of its variants, a `PlannedRow`,
 * also fits.
 */
export type ObjectReturnShape<Types extends SchemaTypes, M extends ModelKey<Types>, Shape> =
  | BuiltReturnShape<Types, M, Shape>
  | PlannedReturnShape<Types, M>;

/** The field naming a base model's variant, or `never` for other models. */
export type DiscriminatorField<Types extends SchemaTypes, M extends ModelKey<Types>> =
  ModelDefOf<Types['PrismaNextContract'], M> extends {
    readonly discriminator: { readonly field: infer F extends string };
  }
    ? F & keyof Row<Types, M>
    : never;

/**
 * What a field returning a model's `prismaInterface` may resolve to: `ObjectReturnShape`, and for a
 * discriminated model also the discriminator, because the interface routes rows to variants before
 * fields run. A row planned for another type of the model, such as one of its variants' types,
 * needn't hold it, so a planned row needs it too.
 */
export type InterfaceReturnShape<Types extends SchemaTypes, M extends ModelKey<Types>, Shape> = [
  DiscriminatorField<Types, M>,
] extends [never]
  ? ObjectReturnShape<Types, M, Shape>
  : ObjectReturnShape<Types, M, Shape> & Pick<Row<Types, M>, DiscriminatorField<Types, M>>;

export type ExtractModel<Types extends SchemaTypes, ParentShape> = ParentShape extends {
  [prismaModelBrand]?: infer M;
}
  ? M extends ModelKey<Types>
    ? M
    : never
  : never;

/**
 * The model brand and the primary key, which every type's selection loads. Other columns are
 * present only when a `select` declares them. The brand also admits the model's variants. The
 * `M extends string` wrapper makes TypeScript compare two of these shapes by their members, not by
 * `M` alone.
 */
export type ObjectBaseShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  Columns = unknown,
> = M extends string
  ? ModelBrand<M | VariantModelKeys<Types['PrismaNextContract'], M>> &
      Merge<Pick<Row<Types, M>, IdentityFields<Types, M> & keyof Row<Types, M>> & Columns>
  : never;

/**
 * A type's shape as the parent of its fields. A base model's brand admits its variants, so it is
 * narrowed to the model here. Other shapes name only their own model.
 */
export type FieldParentShape<Types extends SchemaTypes, M extends ModelKey<Types>, Shape> = [
  VariantModelKeys<Types['PrismaNextContract'], M>,
] extends [never]
  ? Shape
  : Shape & ModelBrand<M>;

/** Node IDs must load back as the same row, so they can't use a nullable column. */
export type IdColumn<Types extends SchemaTypes, M extends ModelKey<Types>> = {
  [K in keyof Row<Types, M> & string]: null extends Row<Types, M>[K] ? never : K;
}[keyof Row<Types, M> & string];

/** A node ID's decoded values: the column's value, or a tuple for a compound ID. */
export type IdValues<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  IDFields,
> = IDFields extends readonly (keyof Row<Types, M>)[]
  ? { -readonly [K in keyof IDFields]: Row<Types, M>[IDFields[K] & keyof Row<Types, M>] }
  : IDFields extends keyof Row<Types, M>
    ? Row<Types, M>[IDFields]
    : never;

/**
 * What `id.parse` may return. A compound ID's array isn't contextually typed as a tuple there, so
 * any array of its columns' values is accepted. The loader checks its length.
 */
export type ParsedIdValues<Types extends SchemaTypes, M extends ModelKey<Types>, IDFields> =
  | IdValues<Types, M, IDFields>
  | (IDFields extends readonly (keyof Row<Types, M>)[]
      ? readonly Row<Types, M>[IDFields[number] & keyof Row<Types, M>][]
      : never);

export type IdFieldShape<
  Types extends SchemaTypes,
  M extends ModelKey<Types>,
  IDFields,
> = IDFields extends readonly (infer K extends keyof Row<Types, M>)[]
  ? Pick<Row<Types, M>, K>
  : IDFields extends keyof Row<Types, M>
    ? Pick<Row<Types, M>, IDFields>
    : unknown;
