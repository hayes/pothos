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
  typeBrandKey,
  TypeParam,
} from '@giraphql/core';
import { PrismaObjectFieldBuilder } from './field-builder.js';

export interface PrismaDelegate {
  findUnique: (args: {}) => Promise<unknown>;
}

type ModelKeys<Prisma extends {}> = {
  [K in keyof Prisma]: Prisma[K] extends { findUnique: unknown } ? K & string : never;
}[keyof Prisma];

type RelationKeys<T> = {
  [K in keyof T]: T[K] extends (args: {}) => {
    then: (cb: (result: unknown) => unknown) => unknown;
  }
    ? K
    : never;
}[keyof T];

export type PrismaTypes<Prisma extends {}> = Normalize<
  {
    [K in ModelKeys<Prisma> as Capitalize<K>]: Prisma[K] extends {
      findUnique: (
        options: infer UniqueOptions & {
          include?: infer Include | null | undefined;
          where?: infer Where | null | undefined;
          select?: infer Select | null | undefined;
        },
      ) => infer Chain & {
        then: (cb: (result: infer Shape | null) => unknown) => unknown;
      };
    }
      ? PrismaModelTypes & {
          Shape: Shape;
          Include: Include;
          Where: Where;
          Fields: keyof Select;
          ListRelation: ListRelationFields<Include> & string;
          Relations: Normalize<
            {
              [RelationName in RelationKeys<Chain>]: Chain[RelationName] extends (args: {}) => {
                then: (cb: (result: infer Relation) => unknown) => unknown;
              }
                ? Relation
                : never;
            }
          >;
        }
      : never;
  }
>;

export interface PrismaModelTypes {
  Shape: {};
  Include: {};
  Where: {};
  Fields: string;
  ListRelation: string;
  Relations: {};
}

export type ListRelationFields<T> = {
  [K in keyof T]: T[K] extends infer Option
    ? Option extends { orderBy?: unknown }
      ? K
      : never
    : never;
}[keyof T];

export type ShapeFromName<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
> = Types['PrismaTypes'][Name]['Shape'];

export type PrismaObjectFieldsShape<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  NeedsResolve extends boolean,
> = (t: PrismaObjectFieldBuilder<Types, Model, NeedsResolve>) => FieldMap;

export type PrismaObjectTypeOptions<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
  Interfaces extends InterfaceParam<Types>[],
  FindUnique,
  Model extends Types['PrismaTypes'][Name] = Types['PrismaTypes'][Name],
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ObjectRef<Model['Shape']>>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
      Types,
      ObjectRef<Model['Shape']>,
      Interfaces
    >,
  'fields'
> & {
  name?: string;
  fields?: PrismaObjectFieldsShape<Types, Model, FindUnique extends null ? true : false>;
  findUnique: FindUnique &
    (((parent: Model['Shape'], context: Types['Context']) => Model['Where']) | null);
};

export type PrismaNodeOptions<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
  Interfaces extends InterfaceParam<Types>[],
  Model extends Types['PrismaTypes'][Name] = Types['PrismaTypes'][Name],
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ObjectRef<Model['Shape']>>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
      Types,
      ObjectRef<Model['Shape']>,
      Interfaces
    >,
  'fields' | 'isTypeOf'
> & {
  name?: string;
  id: Omit<
    FieldOptionsFromKind<
      Types,
      Model['Shape'],
      'ID',
      false,
      {},
      'Object',
      OutputShape<Types, 'ID'>,
      MaybePromise<OutputShape<Types, 'ID'>>
    >,
    'args' | 'nullable' | 'resolve' | 'type'
  > & {
    resolve: (
      parent: Model['Shape'],
      context: Types['Context'],
    ) => MaybePromise<OutputShape<Types, 'ID'>>;
  };
  fields?: PrismaObjectFieldsShape<Types, Model, false>;
  findUnique: (id: string, context: Types['Context']) => Model['Where'];
};

export type ModelName<Types extends SchemaTypes> = keyof Types['PrismaTypes'];

export type QueryForField<
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

export type IncludeFromRelation<
  Model extends PrismaModelTypes,
  Field extends keyof Model['Include'],
> = Model['Include'][Field] extends infer Include
  ? Include extends {
      include?: infer T;
    }
    ? NonNullable<T>
    : never
  : never;

export type CursorFromRelation<
  Model extends PrismaModelTypes,
  Field extends Model['ListRelation'],
> = Field extends keyof Model['Include']
  ? Model['Include'][Field] extends infer Include
    ? Include extends { cursor?: infer T }
      ? keyof T
      : never
    : never
  : never;

export type RefForRelation<
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
> = Omit<
  GiraphQLSchemaTypes.ObjectFieldOptions<
    Types,
    Model['Shape'],
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
          query: { include?: IncludeFromRelation<Model, Field> },
          parent: Model['Shape'],
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<Model['Relations'][Field]>;
      }
    : {
        resolve: (
          query: { include?: IncludeFromRelation<Model, Field> },
          parent: Model['Shape'],
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<Model['Relations'][Field]>;
      }) & {
    query?: QueryForField<Types, Args, Model['Include'][Field]>;
  };

export type PrismaFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends ModelName<Types> | [ModelName<Types>],
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
  Name extends ModelName<Types>,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
  Model extends PrismaModelTypes = Types['PrismaTypes'][Name],
  // eslint-disable-next-line @typescript-eslint/sort-type-union-intersection-members
> = Omit<
  GiraphQLSchemaTypes.ConnectionFieldOptions<
    Types,
    ParentShape,
    Param,
    Nullable,
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
      Args & InputFieldsFromShape<GiraphQLSchemaTypes.DefaultConnectionArguments>,
      Kind,
      ParentShape,
      ResolveReturnShape
    >,
    'args' | 'resolve' | 'type'
  > & {
    type: Name;
    cursor: keyof Model['Where'];
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
      args: GiraphQLSchemaTypes.DefaultConnectionArguments & InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<Model['Shape'][]>;
  };

export type RelatedConnectionOptions<
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Field extends Model['ListRelation'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  NeedsResolve extends boolean,
  // eslint-disable-next-line @typescript-eslint/sort-type-union-intersection-members
> = Omit<
  GiraphQLSchemaTypes.ObjectFieldOptions<
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
    GiraphQLSchemaTypes.ConnectionFieldOptions<
      Types,
      Model['Shape'],
      ObjectRef<unknown>,
      Nullable,
      Args,
      unknown
    >,
    'resolve' | 'type'
  > & {
    query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
    cursor: CursorFromRelation<Model, Field>;
    defaultSize?: number;
    maxSize?: number;
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
