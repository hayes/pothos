import { FieldNode, GraphQLResolveInfo } from 'graphql';
import {
  ArgumentRef,
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputFieldRef,
  InputFieldsFromShape,
  InputShapeFromFields,
  InterfaceParam,
  ListResolveValue,
  MaybePromise,
  Normalize,
  ObjectRef,
  OutputShape,
  OutputType,
  SchemaTypes,
  ShapeFromTypeParam,
  ShapeWithNullability,
  typeBrandKey,
  TypeParam,
} from '@pothos/core';
import { PrismaInterfaceRef, PrismaRef } from './interface-ref';
import type { PrismaObjectFieldBuilder } from './prisma-field-builder';

export interface PrismaDelegate {
  findUniqueOrThrow?: (...args: any[]) => Promise<unknown>;
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

export type PrismaObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  unknown extends Select
    ? ParentShape
    : ParentShape &
        ShapeFromSelection<
          Types,
          ExtractModel<Types, ParentShape>,
          { select: Select extends (...args: any[]) => infer S ? S : Select }
        >,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
> & {
  select?: Select &
    (
      | ExtractModel<Types, ParentShape>['Select']
      | ((
          args: InputShapeFromFields<Args>,
          ctx: Types['Context'],
          nestedSelection: <Selection extends boolean | {}>(
            selection?: Selection,
            path?: string[],
            type?: string,
          ) => Selection,
        ) => ExtractModel<Types, ParentShape>['Select'])
    );
};

type PrismaObjectFieldsShape<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  NeedsResolve extends boolean,
  Shape extends object,
  Select,
> = Model['Select'] extends Select
  ? (t: PrismaObjectFieldBuilder<Types, Model, NeedsResolve, Shape>) => FieldMap
  : (t: PrismaSelectionFieldBuilder<Types, Model, Shape>) => FieldMap;

type PrismaSelectionFieldBuilder<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object,
> = PrismaObjectFieldBuilder<Types, Model, false, Shape>;

interface BaseSelection {
  include?: unknown;
  select?: unknown;
}

export type SelectedKeys<T> = { [K in keyof T]: T[K] extends false ? never : K }[keyof T];

export type ShapeFromSelection<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Selection,
> = Normalize<
  Selection extends BaseSelection
    ? unknown extends Selection['select']
      ? Model['Shape'] & RelationShapeFromInclude<Types, Model, Selection['include']>
      : Pick<Model['Shape'], SelectedKeys<Selection['select']>> &
          RelationShapeFromInclude<Types, Model, Selection['select']> &
          ('_count' extends keyof Selection['select']
            ? ShapeFromCount<Selection['select']['_count']>
            : {})
    : Model['Shape']
>;

export type ShapeFromCount<Selection> = Selection extends true
  ? { _count: number }
  : Selection extends { select: infer Counts }
    ? { _count: { [K in keyof Counts]: number } }
    : never;

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
  FindUnique,
  Include,
  Select,
  Shape extends object,
> = NameOrVariant &
  (
    | {
        include?: Include & Model['Include'];
        select?: never;
        findUnique?: FindUnique &
          (((parent: Shape, context: Types['Context']) => Model['WhereUnique']) | null);
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
  FindUnique,
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
    FindUnique extends null ? true : false,
    Shape & (FindUnique extends null ? {} : { [prismaModelName]?: Model['Name'] }),
    Select
  >;
};

export type PrismaObjectTypeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  FindUnique,
  Include,
  Select,
  Shape extends object,
> = PrismaObjectImplementationOptions<Types, Model, Interfaces, FindUnique, Select, Shape> &
  PrismaObjectRefOptions<Types, Model, FindUnique, Include, Select, Shape>;

export type PrismaInterfaceRefOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  FindUnique,
  Include,
  Select,
  Shape extends object,
> = NameOrVariant &
  (
    | {
        include?: Include & Model['Include'];
        select?: never;
        findUnique?: FindUnique &
          (((parent: Shape, context: Types['Context']) => Model['WhereUnique']) | null);
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
  FindUnique,
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
    FindUnique extends null ? true : false,
    Shape & (FindUnique extends null ? {} : { [prismaModelName]?: Model['Name'] }),
    Select
  >;
};

export type PrismaInterfaceTypeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  FindUnique,
  Include,
  Select,
  Shape extends object,
> = PrismaInterfaceImplementationOptions<Types, Model, Interfaces, FindUnique, Select, Shape> &
  PrismaInterfaceRefOptions<Types, Model, FindUnique, Include, Select, Shape>;

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
  (UniqueField extends string
    ? {
        findUnique?: (id: string, context: Types['Context']) => Model['WhereUnique'];
      }
    : {
        findUnique: (id: string, context: Types['Context']) => Model['WhereUnique'];
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
      'args' | 'nullable' | 'resolve' | 'type'
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
      false,
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
        ) => Omit<Include, 'include' | 'select'>)
  : never;

type QueryFromRelation<
  Model extends PrismaModelTypes,
  Field extends keyof Model['Include'],
> = Model['Include'][Field] extends infer Include
  ? Include extends {
      include?: infer I;
      select?: infer S;
    }
    ? {
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
  NeedsResolve extends boolean,
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
  'description' | 'resolve' | 'type'
> &
  (NeedsResolve extends false
    ? {
        resolve?: (
          query: QueryFromRelation<Model, Field & keyof Model['Include']>,
          parent: Shape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<
          ShapeWithNullability<Types, Model['Relations'][Field]['Shape'], Nullable>
        >;
      }
    : {
        resolve: (
          query: QueryFromRelation<Model, Field & keyof Model['Include']>,
          parent: Shape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<
          ShapeWithNullability<Types, Model['Relations'][Field]['Shape'], Nullable>
        >;
      }) & {
    description?: string | false;
    type?: PrismaRef<Types, TypesForRelation<Types, Model, Field>>;
    query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
  };

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Variant extends PrismaRef<Types, Model>,
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
  'resolve' | 'type'
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
  NeedsResolve extends boolean,
  Where,
  Args extends InputFieldMap,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Shape, 'Int', false, Args, number>,
  'resolve' | 'type'
> &
  (NeedsResolve extends false
    ? {
        resolve?: (
          parent: Shape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      }
    : {
        resolve: (
          parent: Shape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      }) & {
    where?: Where | ((args: InputShapeFromFields<Args>, context: Types['Context']) => Where);
  };

export type PrismaFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends
    | PrismaRef<Types, PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    | [PrismaRef<Types, PrismaModelTypes>],
  Model extends PrismaModelTypes,
  Param extends TypeParam<Types>,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<Param>,
  ResolveShape,
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
> = FieldOptionsFromKind<
  Types,
  ParentShape,
  Param,
  Nullable,
  Args,
  Kind,
  ResolveShape,
  ResolveReturnShape
> extends infer FieldOptions
  ? Omit<FieldOptions, 'resolve' | 'type'> & {
      type: Type;
      resolve: FieldOptions extends { resolve?: (parent: infer Parent, ...args: any[]) => unknown }
        ? PrismaFieldResolver<Types, Model, Parent, Param, Args, Nullable, ResolveReturnShape>
        : PrismaFieldResolver<Types, Model, ParentShape, Param, Args, Nullable, ResolveReturnShape>;
    }
  : never;

export type PrismaFieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind,
  Args extends Record<string, ArgumentRef<Types, unknown>>,
  Fields extends Record<string, InputFieldRef<Types, unknown>>,
  Type extends
    | PrismaRef<Types, PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    | [PrismaRef<Types, PrismaModelTypes>],
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
  Type extends
    | PrismaInterfaceRef<Types, PrismaModelTypes>
    | PrismaRef<Types, PrismaModelTypes>
    | keyof Types['PrismaTypes'],
  Model extends PrismaModelTypes,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
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
  'args' | 'resolve' | 'type'
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
    'resolve' | 'type'
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
  NeedsResolve extends boolean,
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
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
  'args' | 'description' | 'resolve' | 'type'
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
    'resolve' | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? (NeedsResolve extends false
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
          }
        : {
            resolve: (
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
          }) & {
        description?: string | false;
        query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
        type?: PrismaRef<Types, TypesForRelation<Types, Model, Field>>;
        cursor: CursorFromRelation<Model, Field>;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        totalCount?: NeedsResolve extends false ? boolean : false;
      }
    : never);

export type WithBrand<T> = T & { [typeBrandKey]: string };

export type IncludeMap = Record<string, SelectionMap | boolean>;

export interface SelectionMap {
  select?: Record<string, SelectionMap | boolean>;
  include?: Record<string, SelectionMap | boolean>;
  where?: {};
}

export type FieldSelection =
  | Record<string, SelectionMap | boolean>
  | ((
      args: object,
      context: object,
      mergeNestedSelection: (
        selection: SelectionMap | boolean | ((args: object, context: object) => SelectionMap),
        path?: IndirectInclude | string[],
        type?: string,
      ) => SelectionMap | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
    ) => SelectionMap);

export type LoaderMappings = Record<
  string,
  {
    field: string;
    type: string;
    mappings: LoaderMappings;
    indirectPath: string[];
  }
>;

export interface IndirectInclude {
  getType: () => string;
  path?: { type?: string; name: string }[];
  paths?: { type?: string; name: string }[][];
}

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type PrismaConnectionShape<
  Types extends SchemaTypes,
  T,
  Parent,
  Args extends InputFieldMap,
> = (
  ShapeFromConnection<PothosSchemaTypes.ConnectionShapeHelper<Types, T, false>> extends infer Shape
    ? Shape & {
        parent: Parent;
        args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments;
      }
    : never
) extends infer C
  ? [C] extends [
      { edges: MaybePromise<readonly (infer Edge | null | undefined)[] | null | undefined> },
    ]
    ? Omit<C, 'edges'> & { edges: (Edge & { connection: C })[] }
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
