import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputShapeFromFields,
  InterfaceParam,
  ListResolveValue,
  MaybePromise,
  ObjectRef,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@giraphql/core';
import { PrismaObjectFieldBuilder } from './field-builder';

export interface PrismaDelegate<Shape extends {} = {}, Options extends FindUniqueArgs = never> {
  findUnique: (args: Options) => UniqueReturn<Shape>;
}

export interface UniqueReturn<Shape extends {}> {
  then: (cb: (result: Shape | null) => unknown) => unknown;
}

export interface FindUniqueArgs {
  select?: unknown;
  include?: unknown;
  where?: unknown;
}

export type ShapeFromPrismaDelegate<T> = T extends PrismaDelegate<infer Shape, never>
  ? Shape
  : never;

export type IncludeFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['include']>
  : never;

export type SelectFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['select']>
  : never;

export type WhereFromPrismaDelegate<T> = T extends PrismaDelegate<{}, infer Options>
  ? NonNullable<Options['where']>
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
  name?: String;
  fields?: PrismaObjectFieldsShape<Types, Type, FindUnique extends null ? true : false>;
  findUnique: FindUnique &
    (
      | ((
          parent: ShapeFromPrismaDelegate<DelegateFromName<Types, Name>>,
        ) => WhereFromPrismaDelegate<DelegateFromName<Types, Name>>)
      | null
    );
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
> = Lowercase<Name> extends keyof Types['PrismaClient']
  ? Extract<Types['PrismaClient'][Lowercase<Name>], PrismaDelegate>
  : never;

export type QueryForField<Args extends InputFieldMap, Include> = Include extends object
  ? Include | ((args: InputShapeFromFields<Args>) => Include)
  : never;

export type InlcudeFromRelation<
  Type extends PrismaDelegate,
  Field extends keyof SelectFromPrismaDelegate<Type>,
> = IncludeFromPrismaDelegate<Type>[Field] extends infer Include
  ? Include extends {
      include?: infer X;
    }
    ? NonNullable<X>
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
    query?: QueryForField<Args, Omit<SelectFromPrismaDelegate<Type>[Field], 'include' | 'select'>>;
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
