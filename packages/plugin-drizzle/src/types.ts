import {
  BuildQueryResult,
  DBQueryConfig,
  Many,
  Relation,
  TableRelationalConfig,
  TablesRelationalConfig,
} from 'drizzle-orm';
import { FieldNode, GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldMap,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputFieldsFromShape,
  InputShapeFromFields,
  InterfaceParam,
  InterfaceRef,
  InterfaceTypeOptions,
  ListResolveValue,
  MaybePromise,
  Normalize,
  ObjectRef,
  ObjectTypeOptions,
  OutputType,
  SchemaTypes,
  ShapeFromTypeParam,
  typeBrandKey,
  TypeParam,
} from '@pothos/core';
import type { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import { type DrizzleRef } from './interface-ref';
import { IndirectInclude } from './utils/map-query';
import { SelectionMap } from './utils/selections';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface DrizzlePluginOptions<Types extends SchemaTypes> {
  client: { _: { schema?: TablesRelationalConfig } };
}

export const drizzleTableName = Symbol.for('Pothos.drizzleTableName');

export type DrizzleObjectOptions<
  Types extends SchemaTypes,
  Table,
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  ObjectTypeOptions<Types, ObjectRef<Types, Shape>, Shape, Interfaces> & {
    name: string;
    select?: Selection;
  },
  'fields'
> & {
  fields?: (
    t: DrizzleObjectFieldBuilder<
      Types,
      Table extends keyof Types['DrizzleRelationSchema']
        ? Types['DrizzleRelationSchema'][Table]
        : never,
      Shape & { [drizzleTableName]?: Table }
    >,
  ) => FieldMap;
};

export type DrizzleInterfaceOptions<
  Types extends SchemaTypes,
  Table,
  Shape,
  Selection,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  InterfaceTypeOptions<Types, InterfaceRef<Types, Shape>, Shape, Interfaces> & {
    name: string;
    select?: Selection;
  },
  'fields'
> & {
  fields?: (
    t: DrizzleObjectFieldBuilder<
      Types,
      Table extends keyof Types['DrizzleRelationSchema']
        ? Types['DrizzleRelationSchema'][Table]
        : never,
      Shape & { [drizzleTableName]?: Table }
    >,
  ) => FieldMap;
};

export type DrizzleFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape,
  Param,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args,
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'resolve' | 'type'
> & {
  type: Param;
  resolve: (
    query: DBQueryConfig<
      Param extends [unknown] ? 'many' : 'one',
      false,
      Types['DrizzleRelationSchema'],
      Types['DrizzleRelationSchema'][keyof Types['DrizzleRelationSchema'] &
        (Param extends [unknown] ? Param[0] : Param)]
    >,
    parent: ParentShape,
    args: InputShapeFromFields<Args>,
    ctx: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeFromTypeParam<Types, Type, Nullable>>;
};

export type DrizzleObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  Normalize<
    Omit<
      unknown extends Select
        ? ParentShape
        : BuildQueryResult<
            Types['DrizzleRelationSchema'],
            ExtractTable<Types, ParentShape>,
            Record<string, unknown> & (Select extends (...args: any[]) => infer R ? R : Select)
          > &
            ParentShape,
      typeof drizzleTableName
    >
  >,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
> & {
  select?: Select &
    (
      | DBQueryConfig<
          'one',
          false,
          Types['DrizzleRelationSchema'],
          ExtractTable<Types, ParentShape>
        >
      | ((
          args: InputShapeFromFields<Args>,
          ctx: Types['Context'],
          nestedSelection: <Selection extends boolean | {}>(
            selection?: Selection,
            path?: string[],
          ) => Selection,
        ) => DBQueryConfig<
          'one',
          false,
          Types['DrizzleRelationSchema'],
          ExtractTable<Types, ParentShape>
        >)
    );
};

export type DrizzleFieldSelection =
  | SelectionMap
  | ((
      args: {},
      ctx: object,
      mergeNestedSelection: (
        selection: SelectionMap | boolean | ((args: object, context: object) => SelectionMap),
        path?: IndirectInclude | string[],
      ) => SelectionMap | boolean,
      resolveSelection: (path: string[]) => FieldNode | null,
    ) => SelectionMap);

type ExtractTable<Types extends SchemaTypes, Shape> = Shape extends {
  [drizzleTableName]?: keyof Types['DrizzleRelationSchema'];
}
  ? Types['DrizzleRelationSchema'][NonNullable<Shape[typeof drizzleTableName]>]
  : never;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Table extends TableRelationalConfig,
  Field extends keyof Table['relations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Shape,
> = Omit<
  DrizzleObjectFieldOptions<
    Types,
    Shape,
    RefForRelation<Types, Table['relations'][Field]>,
    Nullable,
    Args,
    {
      columns: {};
      with: { [K in Field]: true };
    },
    ResolveReturnShape
  >,
  'description' | 'resolve' | 'select' | 'type'
> & {
  description?: string | false;
  type?: ObjectRef<Types, TypesForRelation<Types, Table['relations'][Field]>>;
  query?: QueryForField<Types, Args, Table['relations'][Field]>;
};

export type RefForRelation<Types extends SchemaTypes, Rel extends Relation> = Rel extends {
  $relationBrand: 'One';
}
  ? ObjectRef<Types, TypesForRelation<Types, Rel>>
  : [ObjectRef<Types, TypesForRelation<Types, Rel>>];

export type TypesForRelation<Types extends SchemaTypes, Rel extends Relation> = BuildQueryResult<
  Types['DrizzleRelationSchema'],
  Types['DrizzleRelationSchema'][Rel['referencedTable']['_']['name']],
  true
>;

export type QueryForField<
  Types extends SchemaTypes,
  Args extends InputFieldMap,
  Rel extends Relation,
> = (
  Rel extends {
    $relationBrand: 'One';
  }
    ? Omit<
        DBQueryConfig<
          'one',
          false,
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchema'][Rel['referencedTable']['_']['name']]
        >,
        'columns' | 'extra' | 'with'
      >
    : Omit<
        DBQueryConfig<
          'many',
          false,
          Types['DrizzleRelationSchema'],
          Types['DrizzleRelationSchema'][Rel['referencedTable']['_']['name']]
        >,
        'columns' | 'extra' | 'with'
      >
) extends infer QueryConfig
  ? QueryConfig | ((args: InputShapeFromFields<Args>, context: Types['Context']) => QueryConfig)
  : never;

export type ListRelation<T extends TableRelationalConfig> = {
  [K in keyof T['relations']]: T['relations'][K] extends Many<string> ? K : never;
}[keyof T['relations']];

export type DrizzleConnectionFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends
    | DrizzleRef<Types, keyof Types['DrizzleRelationSchema']>
    | keyof Types['DrizzleRelationSchema'],
  TableConfig extends TableRelationalConfig,
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
        cursor: Extract<TableConfig['columns'][string], { isUnique: true }>['name'];
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        resolve: (
          query: {
            // include?: Model['Include'];
            // cursor?: Model['WhereUnique'];
            // take: number;
            // skip: number;
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
  Shape,
  TableConfig extends TableRelationalConfig,
  Field extends keyof TableConfig['relations'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  // eslint-disable-next-line @typescript-eslint/sort-type-constituents
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Shape,
    ObjectRef<Types, unknown>,
    Nullable,
    InputFieldsFromShape<Types, PothosSchemaTypes.DefaultConnectionArguments, 'InputObject'> &
      (InputFieldMap extends Args ? {} : Args),
    unknown
  >,
  'args' | 'resolve' | 'type'
> &
  Omit<
    PothosSchemaTypes.ConnectionFieldOptions<
      Types,
      Shape,
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
    ? {
        resolve?: (
          query: {
            // include?: Model['Include'];
            // cursor?: Model['WhereUnique'];
            // take: number;
            // skip: number;
          },
          parent: Shape,
          args: ConnectionArgs,
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<
          ShapeFromTypeParam<
            Types,
            [ObjectRef<Types, TypesForRelation<Types, TableConfig['relations'][Field]>>],
            Nullable
          >
        >;
        // query?: QueryForField<Types, Args, Model['Include'][Field & keyof Model['Include']]>;
        type?: DrizzleRef<Types, TableConfig['relations'][Field]['referencedTable']['_']['name']>;
        cursor: Extract<
          Types['DrizzleRelationSchema'][TableConfig['relations'][Field]['referencedTable']['_']['name']]['columns'],
          { isUnique: true }
        >['name'];
        defaultSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        maxSize?: number | ((args: ConnectionArgs, ctx: Types['Context']) => number);
        // totalCount?: NeedsResolve extends false ? boolean : false;
      }
    : never);

export type ShapeFromConnection<T> = T extends { shape: unknown } ? T['shape'] : never;

export type DrizzleConnectionShape<
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

export type WithBrand<T> = T & { [typeBrandKey]: string };
