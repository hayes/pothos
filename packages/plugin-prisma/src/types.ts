import {
  type ArgumentRef,
  type CheckAsyncSelection,
  type FieldKind,
  type FieldMap,
  type FieldNullability,
  type FieldOptionsFromKind,
  type InferredFieldOptionKeys,
  type InferredFieldOptionsByKind,
  type InputFieldMap,
  type InputFieldsFromShape,
  type InputShapeFromFields,
  type InterfaceParam,
  type ListResolveValue,
  type MaybeAsyncSelection,
  type MaybePromise,
  type Merge,
  type Normalize,
  type ObjectRef,
  type OutputShape,
  type OutputType,
  type SchemaTypes,
  type ShapeFromTypeParam,
  type ShapeWithNullability,
  type TypeParam,
  typeBrandKey,
} from '@pothos/core';
import type {
  IndirectInclude,
  IndirectPathSegment,
  Mappings,
  PathSegment,
} from '@pothos/selection-mapper';
import type { FieldNode, GraphQLResolveInfo } from 'graphql';
import type { PrismaInterfaceRef, PrismaRef } from './interface-ref.js';
import type { PrismaObjectFieldBuilder } from './prisma-field-builder.js';

export interface PrismaDelegate {
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  findUniqueOrThrow?: (...args: any[]) => Promise<unknown>;
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  findUnique: (...args: any[]) => Promise<unknown>;
}

export const prismaModelName = Symbol.for('Pothos.prismaModelName');

export interface PrismaClient {
  $connect: () => Promise<void>;
}

export interface PrismaModelTypes {
  Name: string;
  Shape: {};
  Include: unknown;
  Select: unknown;
  OrderBy: unknown;
  Where: {};
  WhereUnique: {};
  Create: {};
  Update: {};
  ListRelations: string;
  RelationName: string;
  Relations: Record<
    string,
    {
      Shape: unknown;
      Name: string;
      Nullable: boolean;
      // Types: PrismaModelTypes;
    }
  >;
}

type ExtractModel<Types extends SchemaTypes, ParentShape> = ParentShape extends {
  [prismaModelName]?: infer Name;
}
  ? Types['PrismaTypes'][Name & keyof Types['PrismaTypes']] extends infer Model
    ? Model extends PrismaModelTypes
      ? Model
      : never
    : never
  : never;

/**
 * The model a field's type param names: a prisma ref, the name of a prisma object type (one
 * registered under its model's name, as `prismaObject` does without `name` or `variant`, and so
 * a key of `Types['PrismaTypes']`), or a list of either.
 */
export type ModelForTypeParam<Types extends SchemaTypes, Type> = Type extends [infer Item]
  ? ModelForTypeParam<Types, Item>
  : // biome-ignore lint/suspicious/noExplicitAny: matching against any ref
    Type extends PrismaRef<any, infer Model>
    ? Model
    : Type extends keyof Types['PrismaTypes']
      ? PrismaModelTypes & Types['PrismaTypes'][Type]
      : never;

/**
 * The query a relation of `Model` is loaded with: the arguments prisma accepts on a list relation
 * (the generated `Parent$relationArgs`, which `PrismaModelTypes` does not carry, so the keys are
 * named here from what it does carry), and the `select` or `include` the planner adds beneath it.
 * The scalar fields of the model are the keys of its `Shape`, so `omit` and `distinct` are typed
 * by them.
 */
export interface PrismaRelationQuery<Model extends PrismaModelTypes> {
  select?: Model['Select'];
  include?: Model['Include'];
  omit?: { [K in keyof Model['Shape']]?: boolean };
  where?: Model['Where'];
  orderBy?: Model['OrderBy'] | Model['OrderBy'][];
  cursor?: Model['WhereUnique'];
  take?: number;
  skip?: number;
  distinct?: (keyof Model['Shape'] & string) | (keyof Model['Shape'] & string)[];
}

/**
 * What `nestedSelection` returns: the relation query for `Model`, keeping the keys of the given
 * selection as they were given (so a `select` in it still narrows the parent shape). With no
 * selection, or `true`, it is the relation query itself. A field whose type has no model keeps
 * the selection it was given.
 */
export type NestedSelectionResult<Model extends PrismaModelTypes, Selection> = [Model] extends [
  never,
]
  ? Selection
  : Selection extends boolean
    ? PrismaRelationQuery<Model>
    : Normalize<Omit<PrismaRelationQuery<Model>, keyof Selection> & Selection>;

/**
 * The selection given to `nestedSelection`: the query itself, or a callback building it from the
 * field's arguments and the context. A schema with `AsyncSelections: true` may also give a
 * promise of the query, or an async callback; the result is typed by the query either way, and is
 * a promise at runtime only when a promise or an async callback was given, or a selection beneath
 * it is async, and must then be awaited.
 */
export type NestedSelectionArg<Types extends SchemaTypes, Selection, Args extends InputFieldMap> =
  | Selection
  | (true extends Types['AsyncSelections'] ? PromiseLike<Selection> : never)
  | ((
      args: InputShapeFromFields<Args>,
      ctx: Types['Context'],
    ) => MaybeAsyncSelection<Types, Selection>);

/**
 * The callback a field's `select` function plans the selection beneath the field with: `path`
 * walks a field nested under the field's type, `type` names the type the selection is read as.
 * The selection is typed by the field's model when it has one, so `select: { title: true }`
 * keeps its literal `true`.
 */
export type NestedSelectionFn<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Args extends InputFieldMap = {},
> = <
  Selection extends boolean | ([Model] extends [never] ? {} : PrismaRelationQuery<Model>) = true,
>(
  selection?: NestedSelectionArg<Types, Selection, Args>,
  path?: PathSegment[],
  type?: string,
) => NestedSelectionResult<Model, Selection>;

export type PrismaObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
  Shape = unknown extends Select
    ? ParentShape
    : ParentShape &
        ShapeFromSelection<
          Types,
          ExtractModel<Types, ParentShape>,
          // biome-ignore lint/suspicious/noExplicitAny: this is fine
          { select: Select extends (...args: any[]) => infer S ? Awaited<S> : Select }
        >,
> = PothosSchemaTypes.ObjectFieldOptions<Types, Shape, Type, Nullable, Args, ResolveReturnShape> &
  InferredFieldOptionsByKind<
    Types,
    Types['InferredFieldOptionsKind'],
    Shape,
    Type,
    Nullable,
    Args,
    ResolveReturnShape
  > & {
    /**
     * What the field needs from its parent row. With `AsyncSelections: true` the function may be
     * async, and `nestedSelection` is then a promise when a selection beneath it is async, and
     * must be awaited.
     */
    select?: Select &
      CheckAsyncSelection<Types, Select> &
      (
        | ExtractModel<Types, ParentShape>['Select']
        | ((
            args: InputShapeFromFields<Args>,
            ctx: Types['Context'],
            nestedSelection: NestedSelectionFn<Types, ModelForTypeParam<Types, Type>, Args>,
          ) => MaybeAsyncSelection<Types, ExtractModel<Types, ParentShape>['Select']>)
      );
  };

type PrismaObjectFieldsShape<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object,
  Select,
> = Model['Select'] extends Select
  ? (t: PrismaObjectFieldBuilder<Types, Model, Shape>) => FieldMap
  : (t: PrismaSelectionFieldBuilder<Types, Model, Shape>) => FieldMap;

type PrismaSelectionFieldBuilder<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object,
> = PrismaObjectFieldBuilder<Types, Model, Shape>;

interface BaseSelection {
  include?: unknown;
  select?: unknown;
}

export type SelectedKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : T[K] extends false | undefined ? never : K;
}[keyof T];

/**
 * An absent select loads all scalar columns. Keep Prisma's model-shape convention for an
 * unconstrained generated query type, but do not apply it to an explicit empty or partial map.
 */
type HasNoSelect<Select, Model extends PrismaModelTypes> = unknown extends Select
  ? true
  : [NonNullable<Select>] extends [never]
    ? true
    : keyof Model['Select'] extends keyof NonNullable<Select>
      ? Model['Select'] extends NonNullable<Select>
        ? true
        : false
      : false;

export type ShapeFromSelection<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Selection,
> = Normalize<
  Selection extends BaseSelection
    ? HasNoSelect<Selection['select'], Model> extends true
      ? Model['Shape'] &
          RelationShapeFromInclude<Types, Model, Selection['include']> &
          ShapeFromCount<CountSelection<Selection['include']>, Model>
      : Pick<
          Model['Shape'],
          SelectedKeys<NonNullable<Selection['select']>> & keyof Model['Shape']
        > &
          RelationShapeFromInclude<Types, Model, NonNullable<Selection['select']>> &
          ShapeFromCount<CountSelection<NonNullable<Selection['select']>>, Model>
    : Model['Shape']
>;

/** The `_count` entry of a `select` or `include` map, or `undefined` when there is none. */
type CountSelection<Map> = Map extends { _count: infer Count } ? Count : undefined;

/**
 * What a `_count` selection adds to a row, as prisma returns it: `_count: true` counts every list
 * relation of `Model`, `_count: { select }` the selected ones, and each count is a number.
 */
export type ShapeFromCount<
  Selection,
  Model extends PrismaModelTypes = PrismaModelTypes,
> = Selection extends true
  ? { _count: { [K in Model['ListRelations']]: number } }
  : Selection extends { select: infer Counts }
    ? { _count: { [K in SelectedKeys<Counts>]: number } }
    : {};

export type TypesForRelation<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Relation extends keyof Model['Relations'],
> = Model['Relations'][Relation]['Name'] extends infer Name
  ? Name extends keyof Types['PrismaTypes']
    ? PrismaModelTypes & Types['PrismaTypes'][Name]
    : never
  : never;

type RelationShapeFromInclude<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Include,
> = Normalize<{
  [K in SelectedKeys<Include> as K extends Model['RelationName']
    ? K
    : never]: K extends keyof Model['Relations']
    ? Model['Relations'][K]['Shape'] extends unknown[]
      ? ShapeFromSelection<Types, TypesForRelation<Types, Model, K>, Include[K]>[]
      : Model['Relations'][K]['Nullable'] extends true
        ? ShapeFromSelection<Types, TypesForRelation<Types, Model, K>, Include[K]> | null
        : ShapeFromSelection<Types, TypesForRelation<Types, Model, K>, Include[K]>
    : unknown;
}>;

export type PrismaObjectRefOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Include,
  Select,
  Shape extends object,
> = NameOrVariant &
  (
    | {
        include?: Include & Model['Include'];
        select?: never;
        findUnique?: ((parent: Shape, context: Types['Context']) => Model['WhereUnique']) | null;
      }
    | {
        select: Model['Select'] & Select;
        include?: never;
        findUnique?: (parent: Shape, context: Types['Context']) => Model['WhereUnique'];
      }
  );

export type PrismaObjectImplementationOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  Select,
  Shape extends object,
> = Omit<
  | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
  | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
  'description' | 'fields'
> & {
  description?: string | false;
  fields?: PrismaObjectFieldsShape<
    Types,
    Model,
    Shape & { [prismaModelName]?: Model['Name'] },
    Select
  >;
};

export type PrismaObjectTypeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  Include,
  Select,
  Shape extends object,
> = PrismaObjectImplementationOptions<Types, Model, Interfaces, Select, Shape> &
  PrismaObjectRefOptions<Types, Model, Include, Select, Shape>;

export type PrismaInterfaceRefOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Include,
  Select,
  Shape extends object,
> = NameOrVariant &
  (
    | {
        include?: Include & Model['Include'];
        select?: never;
        findUnique?: ((parent: Shape, context: Types['Context']) => Model['WhereUnique']) | null;
      }
    | {
        select: Model['Select'] & Select;
        include?: never;
        findUnique?: (parent: Shape, context: Types['Context']) => Model['WhereUnique'];
      }
  );

export type PrismaInterfaceImplementationOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  Select,
  Shape extends object,
> = Omit<
  PothosSchemaTypes.InterfaceTypeOptions<Types, Shape, Interfaces>,
  'description' | 'fields'
> & {
  description?: string | false;
  fields?: PrismaObjectFieldsShape<
    Types,
    Model,
    Shape & { [prismaModelName]?: Model['Name'] },
    Select
  >;
};

export type PrismaInterfaceTypeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  Include,
  Select,
  Shape extends object,
> = PrismaInterfaceImplementationOptions<Types, Model, Interfaces, Select, Shape> &
  PrismaInterfaceRefOptions<Types, Model, Include, Select, Shape>;

type NameOrVariant =
  | {
      name?: never;
      variant?: string;
    }
  | {
      name?: string;
      variant?: never;
    };

export type PrismaNodeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  Include,
  Select,
  Shape extends object,
  UniqueField,
> = NameOrVariant &
  Omit<
    | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
    | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
    'fields' | 'isTypeOf'
  > &
  // The where may settle later: it is built from an `id.resolve` that is itself a `MaybePromise`.
  (UniqueField extends string
    ? {
        findUnique?: (id: string, context: Types['Context']) => MaybePromise<Model['WhereUnique']>;
      }
    : {
        findUnique: (id: string, context: Types['Context']) => MaybePromise<Model['WhereUnique']>;
      }) & {
    id: Omit<
      FieldOptionsFromKind<
        Types,
        Shape,
        'ID',
        false,
        {},
        'Object',
        OutputShape<Types, 'ID'>,
        MaybePromise<OutputShape<Types, 'ID'>>
      >,
      'args' | 'nullable' | 'type' | InferredFieldOptionKeys
    > &
      (
        | {
            field?: never;
            resolve: (
              parent: Shape,
              context: Types['Context'],
            ) => MaybePromise<OutputShape<Types, 'ID'>>;
          }
        | {
            resolve?: never;
            field: UniqueField extends UniqueFieldsFromWhereUnique<Model['WhereUnique']>
              ? UniqueField
              : UniqueFieldsFromWhereUnique<Model['WhereUnique']>;
          }
      );
    fields?: PrismaObjectFieldsShape<
      Types,
      Model,
      Shape & { [prismaModelName]?: Model['Name'] },
      Select
    >;
  } & {
    nullable?: boolean;
  } & (
    | {
        include?: Include & Model['Include'];
        select?: never;
      }
    | {
        select: Model['Select'] & Select;
        include?: never;
      }
  );

type QueryForField<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  Include,
> = Include extends { where?: unknown }
  ?
      | Omit<Include, 'include' | 'select'>
      | ((
          args: InputShapeFromFields<Args>,
          ctx: Types['Context'],
        ) => MaybeAsyncSelection<Types, Omit<Include, 'include' | 'select'>>)
  : never;

/**
 * The query a relation's fallback `resolve` is handed: the arguments prisma accepts on the
 * relation (`where`, `orderBy`, `take`, ... for a list relation), with the planned `select` or
 * `include` beneath it.
 */
export type QueryFromRelation<
  Model extends PrismaModelTypes,
  Field extends keyof Model['Include'],
> = Model['Include'][Field] extends infer Include
  ? Include extends {
      include?: infer I;
      select?: infer S;
    }
    ? Omit<Include, 'include' | 'select'> & {
        include?: NonNullable<I>;
        select?: NonNullable<S>;
      }
    : never
  : never;

type CursorFromRelation<
  Model extends PrismaModelTypes,
  Field extends Model['ListRelations'],
> = Field extends keyof Model['Include']
  ? Model['Include'][Field] extends infer Include
    ? Include extends { cursor?: infer T }
      ? UniqueFieldsFromWhereUnique<T>
      : never
    : never
  : never;

type RefForRelation<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Field extends keyof Model['Relations'],
> = Model['Relations'][Field] extends unknown[]
  ? [ObjectRef<Types, Model['Relations'][Field]>]
  : ObjectRef<Types, Model['Relations'][Field]>;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Field extends keyof Model['Relations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Shape,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Shape,
    RefForRelation<Types, Model, Field>,
    Nullable,
    Args,
    ResolveReturnShape
  >,
  'description' | 'type' | InferredFieldOptionKeys
> & {
  resolve?: (
    query: QueryFromRelation<Model, Field & keyof Model['Include']>,
    parent: Shape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeWithNullability<Types, Model['Relations'][Field]['Shape'], Nullable>>;
  description?: string | false;
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  type?: PrismaRef<any, TypesForRelation<Types, Model, Field>>;
  query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
  onNull?:
    | 'error'
    | ((
        parent: Shape,
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => MaybePromise<
        Error | ShapeWithNullability<Types, Model['Relations'][Field]['Shape'], Nullable>
      >);
} & ({
    field: boolean extends Nullable ? Types['DefaultFieldNullability'] : Nullable;
    relation: Model['Relations'][Field]['Nullable'];
  } extends { field: false; relation: true }
    ? { onNull: {} }
    : {});

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  Variant extends PrismaRef<any, Model>,
  Args extends InputFieldMap,
  isNull,
  Shape,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Shape,
    Variant,
    unknown extends isNull ? false : true,
    Args,
    Model['Shape']
  >,
  InferredFieldOptionKeys | 'type'
> & {
  isNull?: isNull &
    ((
      parent: Shape,
      args: InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<boolean>);
};

export type RelationCountOptions<
  Types extends SchemaTypes,
  Shape,
  Where,
  Args extends InputFieldMap,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Shape, 'Int', false, Args, number>,
  'type' | InferredFieldOptionKeys
> & {
  resolve?: (
    parent: Shape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<number>;
  where?:
    | Where
    | ((
        args: InputShapeFromFields<Args>,
        context: Types['Context'],
      ) => MaybeAsyncSelection<Types, Where>);
};

export type PrismaFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | PrismaRef<any, PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | [PrismaRef<any, PrismaModelTypes>],
  Model extends PrismaModelTypes,
  Param extends TypeParam<Types>,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<Param>,
  ResolveShape,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
> =
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Param,
    Nullable,
    Args,
    Kind,
    ResolveShape,
    ResolveReturnShape
  > extends infer FieldOptions
    ? Omit<FieldOptions, InferredFieldOptionKeys | 'type'> & {
        type: Type;
        resolve: FieldOptions extends {
          // biome-ignore lint/suspicious/noExplicitAny: this is fine
          resolve?: (parent: infer Parent, ...args: any[]) => unknown;
        }
          ? PrismaFieldResolver<Types, Model, Parent, Param, Args, Nullable, ResolveReturnShape>
          : PrismaFieldResolver<
              Types,
              Model,
              ParentShape,
              Param,
              Args,
              Nullable,
              ResolveReturnShape
            >;
      }
    : never;

export type PrismaFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind,
  Args extends InputFieldMap,
  Fields extends InputFieldMap,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | PrismaRef<any, PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | [PrismaRef<any, PrismaModelTypes>],
  Model extends PrismaModelTypes,
  Param extends TypeParam<Types>,
  Nullable extends FieldNullability<Param>,
  InputName extends string,
  ResolveShape,
  ResolveReturnShape,
  ArgRequired extends boolean,
> = Omit<
  PrismaFieldOptions<
    Types,
    ParentShape,
    Type,
    Model,
    Param,
    Args & {
      [K in InputName]: ArgumentRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    Nullable,
    ResolveShape,
    ResolveReturnShape,
    Kind
  >,
  'args'
> &
  PothosSchemaTypes.FieldWithInputBaseOptions<
    Types,
    Args & {
      [K in InputName]: ArgumentRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    Fields,
    InputName,
    ArgRequired
  >;

export type PrismaFieldResolver<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Parent,
  Param extends TypeParam<Types>,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<Param>,
  ResolveReturnShape,
> = (
  query: {
    include?: Model['Include'];
    select?: Model['Select'];
  },
  parent: Parent,
  args: InputShapeFromFields<Args>,
  context: Types['Context'],
  info: GraphQLResolveInfo,
) => ShapeFromTypeParam<Types, Param, Nullable> extends infer Shape
  ? [Shape] extends [[readonly (infer Item)[] | null | undefined]]
    ? ListResolveValue<Shape, Item, ResolveReturnShape>
    : MaybePromise<Shape>
  : never;

export type PrismaConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | PrismaInterfaceRef<any, PrismaModelTypes>
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    | PrismaRef<any, PrismaModelTypes>
    | keyof Types['PrismaTypes'],
  Model extends PrismaModelTypes,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Param,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'Arg'> &
      (InputFieldMap extends Args ? {} : Args),
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'args' | InferredFieldOptionKeys | 'type'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      ParentShape,
      Param,
      Nullable,
      false,
      false,
      Args,
      ResolveReturnShape
    >,
    InferredFieldOptionKeys | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        type: Type;
        cursor: UniqueFieldsFromWhereUnique<Model['WhereUnique']>;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        resolve: (
          query: {
            include?: Model['Include'];
            cursor?: Model['WhereUnique'];
            take: number;
            skip: number;
          },
          parent: ParentShape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => ShapeFromTypeParam<Types, [Param], Nullable> extends infer Shape
          ? [Shape] extends [[readonly (infer Item)[] | null | undefined]]
            ? ListResolveValue<Shape, Item, ResolveReturnShape>
            : MaybePromise<Shape>
          : never;
        totalCount?: (
          parent: ParentShape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      }
    : never);

export type RelatedConnectionOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Field extends Model['ListRelations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  Type = unknown,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Model['Shape'],
    ObjectRef<Types, unknown>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'InputObject'> &
      (InputFieldMap extends Args ? {} : Args),
    unknown
  >,
  'args' | 'description' | InferredFieldOptionKeys | 'type'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      Model['Shape'],
      ObjectRef<Types, unknown>,
      false,
      false,
      Nullable,
      Args,
      unknown
    >,
    InferredFieldOptionKeys | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        resolve?: (
          query: {
            include?: Model['Include'];
            cursor?: Model['WhereUnique'];
            take: number;
            skip: number;
          },
          parent: Model['Shape'],
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<
          ShapeFromTypeParam<
            Types,
            [ObjectRef<Types, Model['Relations'][Field & keyof Model['Relations']]['Shape']>],
            Nullable
          >
        >;
      } & {
        description?: string | false;
        query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
        // biome-ignore lint/suspicious/noExplicitAny: this is fine
        type?: Type & PrismaRef<any, TypesForRelation<Types, Model, Field>>;
        cursor: CursorFromRelation<Model, Field>;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        totalCount?: boolean;
      }
    : never);

export type WithBrand<T> = T & { [typeBrandKey]: string };

export type IncludeMap = Record<string, SelectionMap | boolean>;

export interface SelectionMap {
  select?: Record<string, SelectionMap | boolean>;
  include?: Record<string, SelectionMap | boolean>;
  where?: object;
}

/**
 * A field's selection: a static map, or a function that may be async and whose nested-query
 * callback may be too. What the function is handed (`mergeNestedSelection`) keeps its
 * synchronous declared type: it is a promise only when a callback beneath it returned one.
 */
export type FieldSelection =
  | Record<string, SelectionMap | boolean>
  | ((
      args: object,
      context: object,
      mergeNestedSelection: (
        selection:
          | SelectionMap
          | boolean
          | ((args: object, context: object) => MaybePromise<SelectionMap>),
        path?: IndirectInclude | PathSegment[],
        type?: string,
      ) => SelectionMap | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
    ) => MaybePromise<SelectionMap | false | null | undefined>);

/**
 * @deprecated kept for compatibility. The loader mapping record is internal to the plugin and
 * not part of its public API.
 */
export type LoaderMappings = Mappings;

/**
 * A segment of a `path` given to `queryFromInfo` or `nestedSelection`: a field name, or
 * `{ name, type }` to pin the type the field must be selected under (a fragment on it).
 */
export type { IndirectInclude, IndirectPathSegment, PathSegment };

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type PrismaConnectionShape<
  Types extends SchemaTypes,
  T,
  Parent,
  Args extends InputFieldMap,
> =
  Merge<
    ShapeFromConnection<
      PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>
    > extends infer Shape
      ? Shape & {
          parent: Parent;
          args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments;
        }
      : never
  > extends infer C
    ? [C] extends [
        {
          edges: infer Edges;
        },
      ]
      ? Merge<
          Omit<C, 'edges'> & {
            edges: Edges extends Iterable<MaybePromise<infer Edge> | null | undefined>
              ? Merge<Edge & { connection: C }>[]
              : never;
          }
        >
      : C
    : never;

export type UniqueFieldsExtendedWhereUnique<T> = NonNullable<
  T extends infer O
    ? {
        [K in keyof O]: undefined extends O[K] ? never : K;
      }[keyof O]
    : never
>;

export type UniqueFieldsFromWhereUnique<T> = string &
  (UniqueFieldsExtendedWhereUnique<T> extends infer K
    ? [K] extends [never]
      ? keyof T
      : K
    : never);

type Simplify<T> = {
  [K in keyof T]: T[K];
} & {};

// Infer the type of a specific field from a given type
type InferField<T, N extends string> = T extends { [K in N]?: infer U | null } ? U : never;

// Check if a type is nullable
type IsNullable<T> = null extends T ? true : undefined extends T ? true : false;

// Capitalize the first letter of a string
type CapitalizeFirst<S extends string> = S extends `${infer F}${infer R}`
  ? `${Uppercase<F>}${R}`
  : S;

type InferModelShape<Model> = Simplify<
  InferField<Model, 'scalars'> & InferComposites<InferField<Model, 'composites'>>
>;

// Infer relations for a given model
type InferRelations<Model> = {
  [K in keyof Model]: {
    // biome-ignore lint/suspicious/noExplicitAny: matching against any is okay
    Shape: Model[K] extends any[] ? InferModelShape<Model[K][0]>[] : InferModelShape<Model[K]>;
    Name: InferField<InferItemOfArray<Model[K]>, 'name'>;
    Nullable: IsNullable<Model[K]>;
  };
};

// Create a list of keys that represent array relations
type InferRelationList<Model> = {
  // biome-ignore lint/suspicious/noExplicitAny: matching against any is okay
  [K in keyof Model as Model[K] extends any[] ? K : never]: K;
};

// Make a type nullable if IsNullable is true
type MakeNullable<T, IsNullable extends boolean> = IsNullable extends true ? T | null : T;

// Infer the item of an array
type InferItemOfArray<T> = T extends Array<infer U> ? U : T;

// Infers the composites of a given model
type InferComposites<Model> = {
  // biome-ignore lint/suspicious/noExplicitAny: matching against any is okay
  [K in keyof Model]: Model[K] extends any[]
    ? Simplify<
        InferField<Model[K][0], 'scalars'> & InferComposites<InferField<Model[K][0], 'composites'>>
      >[]
    : 'composites' extends keyof Exclude<Model[K], null>
      ? MakeNullable<
          Simplify<
            InferField<Model[K], 'scalars'> & InferComposites<InferField<Model[K], 'composites'>>
          >,
          IsNullable<Model[K]>
        >
      : InferField<Model[K], 'scalars'>;
};

type ExtractModelKeys<T> = {
  [K in keyof T]: K extends `$${string}` ? never : K;
}[keyof T];

type PrismaArgs<T, F extends string> = T extends {
  [K: symbol]: {
    types: {
      operations: {
        [K in F]: {
          args: unknown;
        };
      };
    };
  };
}
  ? T[symbol]['types']['operations'][F]['args']
  : unknown;

type PrismaPayload<T> = T extends {
  [K: symbol]: {
    types: {
      payload: unknown;
    };
  };
}
  ? T[symbol]['types']['payload']
  : unknown;

/**
 * Infer PrismaTypes from a PrismaClient
 * @example
 * `type PrismaTypes = PrismaTypesFromClient<typeof prisma>`
 **/
export type PrismaTypesFromClient<ClientType, PrismaUtils extends boolean = false> = {
  [K in ExtractModelKeys<ClientType> as CapitalizeFirst<K & string>]: PrismaModelTypes & {
    Name: CapitalizeFirst<K & string>;
    Shape: InferModelShape<PrismaPayload<ClientType[K]>>;
    Include: InferField<PrismaArgs<ClientType[K], 'findUnique'>, 'include'>;
    Select: InferField<PrismaArgs<ClientType[K], 'findUnique'>, 'select'>;
    OrderBy: InferItemOfArray<InferField<PrismaArgs<ClientType[K], 'findFirst'>, 'orderBy'>>;
    WhereUnique: InferField<PrismaArgs<ClientType[K], 'findUnique'>, 'where'>;
    Where: InferField<PrismaArgs<ClientType[K], 'findFirst'>, 'where'>;
    ListRelations: keyof InferRelationList<InferField<PrismaPayload<ClientType[K]>, 'objects'>>;
    RelationName: keyof InferField<PrismaPayload<ClientType[K]>, 'objects'>;
    Relations: InferRelations<InferField<PrismaPayload<ClientType[K]>, 'objects'>>;
    Create: PrismaUtils extends true ? InferField<PrismaArgs<ClientType[K], 'create'>, 'data'> : {};
    Update: PrismaUtils extends true ? InferField<PrismaArgs<ClientType[K], 'update'>, 'data'> : {};
  };
};

interface DMMFField {
  type: string;
  kind: string;
  name: string;
  isRequired: boolean;
  isList: boolean;
  hasDefaultValue: boolean;
  isUnique: boolean;
  isId: boolean;
  documentation?: string;
  relationName?: string;
  relationFromFields?: readonly string[];
  isUpdatedAt?: boolean;
}

export interface PothosPrismaDatamodel {
  datamodel: {
    models: Record<
      string,
      {
        fields: readonly DMMFField[];
        primaryKey: { name: string | null; fields: readonly string[] } | null;
        uniqueIndexes: { name: string | null; fields: readonly string[] }[];
        documentation?: string;
      }
    >;
  };
}
