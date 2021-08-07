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
  ObjectRef,
  OutputShape,
  OutputType,
  SchemaTypes,
  ShapeFromTypeParam,
  typeBrandKey,
  TypeParam,
} from '@giraphql/core';
import { PrismaObjectFieldBuilder } from './field-builder';

export interface PrismaDelegate<
  Shape extends {} = {},
  Options extends FindUniqueArgs = never,
  ManyOptions extends FindManyArgs = never,
> {
  findUnique: (args: Options) => UniqueReturn<Shape>;
  findMany: (args?: ManyOptions) => unknown;
}

export interface UniqueReturn<Shape extends {}> {
  then: (cb: (result: Shape | null) => unknown) => unknown;
}

export interface FindUniqueArgs {
  select?: unknown;
  include?: unknown;
  where?: unknown;
}

export interface FindManyArgs {
  cursor?: {};
}

export type ShapeFromPrismaDelegate<T> = T extends PrismaDelegate<infer Shape, never>
  ? Shape
  : never;

export type IncludeFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['include']>
  : never;

export type CursorFromPrismaDelegate<T> = T extends PrismaDelegate<{}, never, infer Options>
  ? string & keyof NonNullable<Options['cursor']>
  : never;

export type SelectFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['select']>
  : never;

export type WhereFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['where']>
  : never;

export type ListRelationField<T> = IncludeFromPrismaDelegate<T> extends infer Include
  ? NonNullable<
      {
        [K in keyof Include]: Include[K] extends infer Option
          ? Option extends { orderBy?: unknown }
            ? K
            : never
          : never;
      }[keyof Include]
    >
  : never;

export type RelationShape<
  T extends PrismaDelegate,
  Relation extends keyof IncludeFromPrismaDelegate<T>,
> = ReturnType<T['findUnique']> extends infer Return
  ? {
      [K in Relation]: K extends keyof Return
        ? Return[K] extends (args: {}) => {
            then: (cb: (result: infer Shape) => unknown) => unknown;
          }
          ? Shape
          : never
        : never;
    }[Relation]
  : never;

export type PrismaObjectFieldsShape<
  Types extends SchemaTypes,
  Type extends PrismaDelegate,
  NeedsResolve extends boolean,
> = (t: PrismaObjectFieldBuilder<Types, Type, NeedsResolve>) => FieldMap;

export type PrismaObjectTypeOptions<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
  Interfaces extends InterfaceParam<Types>[],
  FindUnique,
  Type extends DelegateFromName<Types, Name> & PrismaDelegate = DelegateFromName<Types, Name>,
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ObjectRef<ShapeFromPrismaDelegate<Type>>>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
      Types,
      ObjectRef<ShapeFromPrismaDelegate<Type>>,
      Interfaces
    >,
  'fields'
> & {
  name?: string;
  fields?: PrismaObjectFieldsShape<Types, Type, FindUnique extends null ? true : false>;
  findUnique: FindUnique &
    (
      | ((
          parent: ShapeFromPrismaDelegate<DelegateFromName<Types, Name>>,
          context: Types['Context'],
        ) => WhereFromPrismaDelegate<DelegateFromName<Types, Name>>)
      | null
    );
};

export type PrismaNodeOptions<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
  Interfaces extends InterfaceParam<Types>[],
  Type extends DelegateFromName<Types, Name> & PrismaDelegate = DelegateFromName<Types, Name>,
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ObjectRef<ShapeFromPrismaDelegate<Type>>>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
      Types,
      ObjectRef<ShapeFromPrismaDelegate<Type>>,
      Interfaces
    >,
  'fields' | 'isTypeOf'
> & {
  name?: string;
  id: Omit<
    FieldOptionsFromKind<
      Types,
      ShapeFromPrismaDelegate<Type>,
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
      parent: ShapeFromPrismaDelegate<Type>,
      context: Types['Context'],
    ) => MaybePromise<OutputShape<Types, 'ID'>>;
  };
  fields?: PrismaObjectFieldsShape<Types, Type, false>;
  findUnique: (
    id: string,
    context: Types['Context'],
  ) => WhereFromPrismaDelegate<DelegateFromName<Types, Name>>;
};

export type ModelName<Types extends SchemaTypes> = {
  [K in keyof Types['PrismaClient']]: Types['PrismaClient'][K] extends PrismaDelegate
    ? K extends string
      ? Capitalize<K>
      : never
    : never;
}[keyof Types['PrismaClient']];

export type DelegateFromName<
  Types extends SchemaTypes,
  Name extends ModelName<Types>,
> = Uncapitalize<Name> extends keyof Types['PrismaClient']
  ? Extract<Types['PrismaClient'][Uncapitalize<Name>], PrismaDelegate>
  : never;

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

export type InlcudeFromRelation<
  Type extends PrismaDelegate,
  Field extends keyof SelectFromPrismaDelegate<Type>,
> = IncludeFromPrismaDelegate<Type>[Field] extends infer Include
  ? Include extends {
      include?: infer T;
    }
    ? NonNullable<T>
    : never
  : never;

export type CursorFromRelation<
  Type extends PrismaDelegate,
  Field extends keyof SelectFromPrismaDelegate<Type>,
> = SelectFromPrismaDelegate<Type>[Field] extends infer Include
  ? Include extends { cursor?: infer T }
    ? keyof T
    : never
  : never;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Type extends PrismaDelegate,
  Field extends keyof SelectFromPrismaDelegate<Type>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape,
  NeedsResolve extends boolean,
> = Omit<
  GiraphQLSchemaTypes.ObjectFieldOptions<
    Types,
    ShapeFromPrismaDelegate<Type>,
    ObjectRef<unknown>,
    Nullable,
    Args,
    ResolveReturnShape
  >,
  'resolve' | 'type'
> &
  (NeedsResolve extends false
    ? {
        resolve?: (
          query: { include?: InlcudeFromRelation<Type, Field> },
          parent: ShapeFromPrismaDelegate<Type>,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<RelationShape<Type, Field>>;
      }
    : {
        resolve: (
          query: { include?: InlcudeFromRelation<Type, Field> },
          parent: ShapeFromPrismaDelegate<Type>,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<RelationShape<Type, Field>>;
      }) & {
    query?: QueryForField<Types, Args, SelectFromPrismaDelegate<Type>[Field]>;
  };

export type PrismaFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends ModelName<Types> | [ModelName<Types>],
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
      include?: IncludeFromPrismaDelegate<Type extends [infer T] ? T : Type>;
    },
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => ShapeFromTypeParam<Types, Param, Nullable> extends infer Shape
    ? Shape extends [readonly (infer Item)[] | null | undefined]
      ? ListResolveValue<Shape, Item, ResolveReturnShape>
      : MaybePromise<Shape>
    : never;
};

export type PrismaConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Name extends ModelName<Types>,
  Type extends PrismaDelegate,
  Param extends OutputType<Types>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Kind extends FieldKind,
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
    cursor: CursorFromPrismaDelegate<Type>;
    defaultSize?: number;
    maxSize?: number;
    resolve: (
      query: {
        include?: IncludeFromPrismaDelegate<Type>;
        cursor?: {};
        take: number;
        skip: number;
      },
      parent: ParentShape,
      args: GiraphQLSchemaTypes.DefaultConnectionArguments & InputShapeFromFields<Args>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<ShapeFromPrismaDelegate<Type>[]>;
  };

export type RelatedConnectionOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends PrismaDelegate,
  Field extends keyof SelectFromPrismaDelegate<Type>,
  Nullable extends boolean,
  Args extends InputFieldMap,
  NeedsResolve extends boolean,
  // eslint-disable-next-line @typescript-eslint/sort-type-union-intersection-members
> = Omit<
  GiraphQLSchemaTypes.ObjectFieldOptions<
    Types,
    ParentShape,
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
      ParentShape,
      ObjectRef<unknown>,
      Nullable,
      Args,
      unknown
    >,
    'resolve' | 'type'
  > & {
    query?: QueryForField<Types, Args, SelectFromPrismaDelegate<Type>[Field]>;
    cursor: CursorFromRelation<Type, Field>;
    defaultSize?: number;
    maxSize?: number;
  } & (NeedsResolve extends false
    ? {
        resolve?: (
          query: {
            include?: IncludeFromPrismaDelegate<Type>;
            cursor?: {};
            take: number;
            skip: number;
          },
          parent: ParentShape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<RelationShape<Type, Field>>;
      }
    : {
        resolve: (
          query: {
            include?: IncludeFromPrismaDelegate<Type>;
            cursor?: {};
            take: number;
            skip: number;
          },
          parent: ParentShape,
          args: InputShapeFromFields<Args>,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<RelationShape<Type, Field>>;
      });

export type WithBrand<T> = T & { [typeBrandKey]: string };
