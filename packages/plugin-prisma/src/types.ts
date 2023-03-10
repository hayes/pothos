import { FieldNode, GraphQLResolveInfo } from 'graphql';
import {
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
import type { PrismaObjectFieldBuilder } from './field-builder';
import { PrismaObjectRef } from './object-ref';

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
  ListRelations: string;
  RelationName: string;
  Relations: Record<
    string,
    {
      Shape: unknown;
      Types: PrismaModelTypes;
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

export type ShapeFromSelection<Model extends PrismaModelTypes, Selection> = Normalize<
  Selection extends BaseSelection
    ? unknown extends Selection['select']
      ? Model['Shape'] & RelationShapeFromInclude<Model, Selection['include']>
      : Pick<Model['Shape'], SelectedKeys<Selection['select']>> &
          RelationShapeFromInclude<Model, Selection['select']> &
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

type RelationShapeFromInclude<Model extends PrismaModelTypes, Include> = Normalize<{
  [K in SelectedKeys<Include> as K extends Model['RelationName']
    ? K
    : never]: K extends keyof Model['Relations']
    ? Model['Relations'][K]['Shape'] extends unknown[]
      ? ShapeFromSelection<Model['Relations'][K]['Types'], Include[K]>[]
      : ShapeFromSelection<Model['Relations'][K]['Types'], Include[K]>
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
  'fields' | 'description'
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
> = PrismaObjectRefOptions<Types, Model, FindUnique, Include, Select, Shape> &
  PrismaObjectImplementationOptions<Types, Model, Interfaces, FindUnique, Select, Shape>;

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
  > & {
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
            field: UniqueField extends keyof Model['WhereUnique']
              ? UniqueField
              : keyof Model['WhereUnique'];
          }
      );
    fields?: PrismaObjectFieldsShape<
      Types,
      Model,
      false,
      Shape & { [prismaModelName]?: Model['Name'] },
      Select
    >;
  } & (UniqueField extends string
    ? {
        findUnique?: (id: string, context: Types['Context']) => Model['WhereUnique'];
      }
    : {
        findUnique: (id: string, context: Types['Context']) => Model['WhereUnique'];
      }) &
  (
    | {
        include?: Include & Model['Include'];
        select?: never;
      }
    | {
        select: Model['Select'] & Select;
        include?: never;
      }
  ) & {
    nullable?: boolean;
  };

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
    ? { include?: NonNullable<I>; select?: NonNullable<S> }
    : never
  : never;

type CursorFromRelation<
  Model extends PrismaModelTypes,
  Field extends Model['ListRelations'],
> = Field extends keyof Model['Include']
  ? Model['Include'][Field] extends infer Include
    ? Include extends { cursor?: infer T }
      ? keyof T
      : never
    : never
  : never;

type RefForRelation<
  Model extends PrismaModelTypes,
  Field extends keyof Model['Relations'],
> = Model['Relations'][Field] extends unknown[]
  ? [ObjectRef<Model['Relations'][Field]>]
  : ObjectRef<Model['Relations'][Field]>;

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
    RefForRelation<Model, Field>,
    Nullable,
    Args,
    ResolveReturnShape
  >,
  'resolve' | 'type' | 'description'
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
    type?: PrismaObjectRef<Model['Relations'][Field]['Types']>;
    query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
  };

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Variant extends PrismaObjectRef<Model>,
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
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Shape, 'Int', false, {}, number>,
  'resolve' | 'type'
> &
  (NeedsResolve extends false
    ? {
        where?: Where | ((args: {}, context: Types['Context']) => Where);
        resolve?: (
          parent: Shape,
          args: {},
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      }
    : {
        where?: Where | ((args: {}, context: Types['Context']) => Where);
        resolve: (
          parent: Shape,
          args: {},
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      });

export type PrismaFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends
    | PrismaObjectRef<PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    | [PrismaObjectRef<PrismaModelTypes>],
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
  Args extends Record<string, InputFieldRef<unknown, 'Arg'>>,
  Fields extends Record<string, InputFieldRef<unknown, 'InputObject'>>,
  Type extends
    | PrismaObjectRef<PrismaModelTypes>
    | keyof Types['PrismaTypes']
    | [keyof Types['PrismaTypes']]
    | [PrismaObjectRef<PrismaModelTypes>],
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
    {
      [K in InputName]: InputFieldRef<
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    } & Args,
    Nullable,
    ResolveShape,
    ResolveReturnShape,
    Kind
  >,
  'args'
> &
  PothosSchemaTypes.FieldWithInputBaseOptions<
    Types,
    {
      [K in InputName]: InputFieldRef<
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    } & Args,
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
  Type extends PrismaObjectRef<PrismaModelTypes> | keyof Types['PrismaTypes'],
  Model extends PrismaModelTypes,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
> = Omit<
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
  Omit<
    FieldOptionsFromKind<
      Types,
      ParentShape,
      Param,
      Nullable,
      (InputFieldMap extends Args ? {} : Args) &
        InputFieldsFromShape<PothosSchemaTypes.DefaultConnectionArguments>,
      Kind,
      ParentShape,
      ResolveReturnShape
    >,
    'args' | 'resolve' | 'type'
  > &
  (InputShapeFromFields<Args> &
    PothosSchemaTypes.DefaultConnectionArguments extends infer ConnectionArgs
    ? {
        type: Type;
        cursor: string & keyof Model['WhereUnique'];
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
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Model['Shape'],
    ObjectRef<unknown>,
    Nullable,
    (InputFieldMap extends Args ? {} : Args) &
      InputFieldsFromShape<PothosSchemaTypes.DefaultConnectionArguments>,
    unknown
  >,
  'resolve' | 'type' | 'args' | 'description'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      Model['Shape'],
      ObjectRef<unknown>,
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
    ? {
        description?: string | false;
        query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
        type?: PrismaObjectRef<Model['Relations'][Field]['Types']>;
        cursor: CursorFromRelation<Model, Field>;
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        totalCount?: NeedsResolve extends false ? boolean : false;
      } & (NeedsResolve extends false
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
                [ObjectRef<Model['Relations'][Field & keyof Model['Relations']]['Shape']>],
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
                [ObjectRef<Model['Relations'][Field & keyof Model['Relations']]['Shape']>],
                Nullable
              >
            >;
          })
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
        path?: string[] | IndirectInclude,
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
  path: { type?: string; name: string }[];
}

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;
