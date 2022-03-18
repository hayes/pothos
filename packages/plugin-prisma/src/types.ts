import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
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
import { PrismaObjectFieldBuilder } from './field-builder';
import { PrismaObjectRef } from './object-ref';

export interface PrismaDelegate {
  findUnique: (...args: any[]) => Promise<unknown>;
}

export const prismaModelName = Symbol.for('Pothos.prismaModelName');

export interface PrismaModelTypes {
  Name: string;
  Shape: {};
  Include: unknown;
  Select: unknown;
  Where: {};
  Fields: string;
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
          RelationShapeFromInclude<Model, Selection['select']>
    : Model['Shape']
>;

type RelationShapeFromInclude<Model extends PrismaModelTypes, Include> = Normalize<{
  [K in SelectedKeys<Include> as K extends Model['RelationName']
    ? K
    : never]: K extends keyof Model['Relations']
    ? Model['Relations'][K]['Shape'] extends unknown[]
      ? ShapeFromSelection<Model['Relations'][K]['Types'], Include[K]>[]
      : ShapeFromSelection<Model['Relations'][K]['Types'], Include[K]>
    : unknown;
}>;

export type PrismaObjectTypeOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Interfaces extends InterfaceParam<Types>[],
  FindUnique,
  Include,
  Select,
  Shape extends object,
> = NameOrVariant &
  Omit<
    | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
    | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
    'fields'
  > & {
    fields?: PrismaObjectFieldsShape<
      Types,
      Model,
      FindUnique extends null ? true : false,
      Shape & (FindUnique extends null ? {} : { [prismaModelName]?: Model['Name'] }),
      Select
    >;
  } & (
    | {
        include?: Include & Model['Include'];
        select?: never;
        findUnique: FindUnique &
          (((parent: Shape, context: Types['Context']) => Model['Where']) | null);
      }
    | {
        select: Model['Select'] & Select;
        include?: never;
        findUnique: (parent: Shape, context: Types['Context']) => Model['Where'];
      }
  );

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
    > & {
      resolve: (parent: Shape, context: Types['Context']) => MaybePromise<OutputShape<Types, 'ID'>>;
    };
    fields?: PrismaObjectFieldsShape<
      Types,
      Model,
      false,
      Shape & { [prismaModelName]?: Model['Name'] },
      Select
    >;
    findUnique: (id: string, context: Types['Context']) => Model['Where'];
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
  'resolve' | 'type'
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
    type?: PrismaObjectRef<Model['Relations'][Field]['Types']>;
    query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
  };

export type VariantFieldOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Variant extends PrismaObjectRef<Model>,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Model['Shape'], Variant, false, {}, Model['Shape']>,
  'resolve' | 'type'
>;

export type RelationCountOptions<
  Types extends SchemaTypes,
  Shape,
  NeedsResolve extends boolean,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<Types, Shape, 'Int', false, {}, number>,
  'resolve' | 'type'
> &
  (NeedsResolve extends false
    ? {
        resolve?: (
          parent: Shape,
          args: {},
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<number>;
      }
    : {
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
  ResolveReturnShape,
  Kind extends FieldKind = FieldKind,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Param,
    Nullable,
    Args,
    Kind,
    ParentShape,
    ResolveReturnShape
  >,
  'resolve' | 'type'
> & {
  type: Type;
  resolve: (
    query: {
      include?: Model['Include'];
    },
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => ShapeFromTypeParam<Types, Param, Nullable> extends infer Shape
    ? [Shape] extends [[readonly (infer Item)[] | null | undefined]]
      ? ListResolveValue<Shape, Item, ResolveReturnShape>
      : MaybePromise<Shape>
    : never;
};

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
      Args & InputFieldsFromShape<PothosSchemaTypes.DefaultConnectionArguments>,
      Kind,
      ParentShape,
      ResolveReturnShape
    >,
    'args' | 'resolve' | 'type'
  > & {
    type: Type;
    cursor: string & keyof Model['Where'];
    defaultSize?: number;
    maxSize?: number;
    resolve: (
      query: {
        include?: Model['Include'];
        cursor?: {};
        take: number;
        skip: number;
      },
      parent: ParentShape,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<Model['Shape'][]>;
    totalCount?: (
      parent: ParentShape,
      args: InputShapeFromFields<Args> & PothosSchemaTypes.DefaultConnectionArguments,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<number>;
  };

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
    Args,
    unknown
  >,
  'resolve' | 'type'
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
  > & {
    query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
    type?: PrismaObjectRef<Model['Relations'][Field]['Types']>;
    cursor: CursorFromRelation<Model, Field>;
    defaultSize?: number;
    maxSize?: number;
    totalCount?: NeedsResolve extends false ? boolean : false;
  } & (NeedsResolve extends false
    ? {
        resolve?: (
          query: {
            include?: Model['Include'];
            cursor?: {};
            take: number;
            skip: number;
          },
          parent: Model['Shape'],
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<Model['Relations'][Field & keyof Model['Relations']]>;
      }
    : {
        resolve: (
          query: {
            include?: Model['Include'];
            cursor?: {};
            take: number;
            skip: number;
          },
          parent: Model['Shape'],
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<Model['Relations'][Field & keyof Model['Relations']]>;
      });

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
      query: (
        selection: SelectionMap | boolean | ((args: object, context: object) => SelectionMap),
      ) => SelectionMap | boolean,
    ) => SelectionMap);

export type LoaderMappings = Record<
  string,
  {
    field: string;
    mappings: LoaderMappings;
    indirectPath: string[];
  }
>;

export interface IndirectInclude {
  getType: () => string;
  path: { type?: string; name: string }[];
}

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;
