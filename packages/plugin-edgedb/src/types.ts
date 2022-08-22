import type { Client } from 'edgedb';
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
  Normalize,
  ObjectRef,
  SchemaTypes,
  ShapeFromTypeParam,
  ShapeWithNullability,
  TypeParam,
} from '@pothos/core';
import type { EdgeDBObjectFieldBuilder } from './edgedb-field-builder';
import { GraphQLResolveInfo } from 'graphql';
import { EdgeDBObjectRef } from './object-ref';

export interface EdgeDBQueryBuilder {
  default: unknown;
}
export interface EdgeDBDriver extends Client {}

export type EdgeDBSchemaTypeKeys<Types extends SchemaTypes = SchemaTypes> =
  keyof Types['EdgeDBTypes']['default'] extends infer Key
    ? Key extends string
      ? Key
      : never
    : never;

export type EdgeDBDefaultExportKeyTypes<DefaultExports> = {
  [K in keyof DefaultExports]-?: K extends string
    ? string
    : K extends number
    ? number
    : K extends symbol
    ? symbol
    : never;
}[keyof DefaultExports];

type EdgeDBModelKeyAsString<
  DefaultExports,
  KeyType extends string | number | symbol = EdgeDBDefaultExportKeyTypes<DefaultExports>,
> = Extract<keyof DefaultExports, KeyType>;

export type EdgeDBSchemaTypes<Types extends SchemaTypes> =
  Types['EdgeDBTypes']['default'] extends infer ObjectTypeMap
    ? ObjectTypeMap extends object
      ? ObjectTypeMap
      : never
    : never;

export interface EdgeDBModelTypes {
  Name: string;
  Shape: {};
  ReturnShape: {};
  MultiLink: string;
  LinkName: string;
  Links: Record<
    string,
    {
      Shape: unknown;
      Types: EdgeDBModelTypes;
    }
  >;
}

export type EdgeDBModelShape<
  Types extends SchemaTypes,
  Name extends EdgeDBSchemaTypeKeys<Types>,
> = EdgeDBSchemaTypes<Types>[Name] extends infer ModelProperties
  ? ModelProperties extends BaseObject
    ? {
        Name: Name;
        Shape: ModelProperties;
        ReturnShape: {
          [K in keyof ModelProperties]?: ModelProperties[K] extends ObjectType
            ? ModelProperties[K] extends infer Link
              ? { [K in keyof Link]?: Link[K] }
              : ModelProperties[K]
            : ModelProperties[K];
        };
        MultiLink: extractMultiLinks<ModelProperties> extends infer Link
          ? Link extends string
            ? SplitLT<Link>
            : never
          : never;
        LinkName: extractLinks<ModelProperties> extends infer Link
          ? Link extends string
            ? SplitLT<Link>
            : never
          : never;
      } extends infer ModelTypesWithoutLinks
      ? ModelTypesWithoutLinks extends {
          LinkName: string;
          Shape: Record<string, unknown>;
        }
        ? ModelTypesWithoutLinks & {
            Links: {
              [Key in ModelTypesWithoutLinks['LinkName']]: {
                Shape: ModelTypesWithoutLinks['Shape'][Key] extends infer Shape
                  ? Shape extends BaseObject
                    ? { [K in keyof Shape]?: Shape[K] }
                    : Shape extends Array<BaseObject>
                    ? { [K in keyof Shape[0]]?: Shape[0][K] }
                    : never
                  : never;
                Types: EdgeDBModelShape<
                  Types,
                  ModelTypesWithoutLinks['Shape'][Key] extends infer Base
                    ? Base extends TypeSet<ObjectType>
                      ? Base['__element__']['__name__'] extends infer ModelName
                        ? ModelName extends string
                          ? SplitDefault<ModelName> extends EdgeDBSchemaTypeKeys<Types>
                            ? SplitDefault<ModelName>
                            : never
                          : never
                        : never
                      : never
                    : never
                >;
              };
            };
          }
        : ModelTypesWithoutLinks & { Links: {} }
      : never
    : never
  : never;

export type SelectedKeys<T> = { [K in keyof T]: T[K] extends false ? never : K }[keyof T];

// --
// EdgeDB Types
// --
export enum Cardinality {
  AtMostOne = 'AtMostOne',
  One = 'One',
  Many = 'Many',
  AtLeastOne = 'AtLeastOne',
  Empty = 'Empty',
}

export enum TypeKind {
  scalar = 'scalar',
  // castonlyscalar = "castonlyscalar",
  enum = 'enum',
  object = 'object',
  namedtuple = 'namedtuple',
  tuple = 'tuple',
  array = 'array',
  range = 'range',
}
export type tupleOf<T> = [T, ...T[]] | [];

export type CardinalityAssignable<Card extends Cardinality> = {
  Empty: Cardinality.Empty;
  One: Cardinality.One;
  AtLeastOne: Cardinality.One | Cardinality.Many | Cardinality.AtLeastOne;
  AtMostOne: Cardinality.One | Cardinality.AtMostOne | Cardinality.Empty;
  Many: Cardinality.Many;
}[Card];

export interface BaseObject {
  id: any;
  __type__: any;
}
export interface BaseType {
  __kind__: TypeKind;
  __name__: string;
}
export type BaseTypeSet = {
  __element__: BaseType;
  __cardinality__: Cardinality;
};
export type BaseTypeTuple = tupleOf<BaseType>;

export interface ScalarType<
  Name extends string = string,
  TsType extends any = any,
  TsConstType extends TsType = TsType,
> extends BaseType {
  __kind__: TypeKind.scalar;
  __tstype__: TsType;
  __tsconsttype__: TsConstType;
  __name__: Name;
}

export interface TypeSet<T extends BaseType = BaseType, Card extends Cardinality = Cardinality> {
  __element__: T;
  __cardinality__: Card;
}

export type PropertyShape = {
  [k: string]: PropertyDesc;
};

export interface PropertyDesc<
  Type extends BaseType = BaseType,
  Card extends Cardinality = Cardinality,
  Exclusive extends boolean = boolean,
  Computed extends boolean = boolean,
  Readonly extends boolean = boolean,
  HasDefault extends boolean = boolean,
> {
  __kind__: 'property';
  target: Type;
  cardinality: Card;
  exclusive: Exclusive;
  computed: Computed;
  readonly: Readonly;
  hasDefault: HasDefault;
}

export interface LinkDesc<
  Type extends ObjectType = any,
  Card extends Cardinality = Cardinality,
  LinkProps extends PropertyShape = any,
  Exclusive extends boolean = boolean,
  Computed extends boolean = boolean,
  Readonly extends boolean = boolean,
  HasDefault extends boolean = boolean,
> {
  __kind__: 'link';
  target: Type;
  cardinality: Card;
  properties: LinkProps;
  exclusive: Exclusive;
  computed: Computed;
  readonly: Readonly;
  hasDefault: HasDefault;
}

export type ObjectTypeSet = TypeSet<ObjectType, Cardinality>;
export type ObjectTypeExpression = TypeSet<ObjectType, Cardinality>;

export interface ObjectType<
  Name extends string = string,
  Pointers extends ObjectTypePointers = ObjectTypePointers,
  Shape extends object | null = any,
  // Polys extends Poly[] = any[]
> extends BaseType {
  __kind__: TypeKind.object;
  __name__: Name;
  __pointers__: Pointers;
  __shape__: Shape;
}

export type ObjectTypePointers = {
  [k: string]: PropertyDesc | LinkDesc;
};

export interface PathParent<Parent extends ObjectTypeSet = ObjectTypeSet> {
  type: Parent;
  linkName: string;
}

export namespace EdgeDB {
  export interface Datamodel {
    [key: string]: TypeSet<ObjectType>;
  }
}

type PointersToObjectType<P extends ObjectTypePointers> = ObjectType<string, P, {}>;

export type SelectModifiers = {
  filter?: TypeSet<ScalarType<'std::bool', boolean>, Cardinality>;
  order_by?: any;
  offset?: any | number;
  limit?: any | number;
};

// ---

// object types -> pointers
// pointers -> links
// links -> target object type
// links -> link properties
export type extractObjectShapeToSelectShape<TObject extends ObjectType = ObjectType> = Partial<{
  [k in keyof TObject['__pointers__']]: TObject['__pointers__'][k] extends PropertyDesc
    ?
        | boolean
        | TypeSet<
            TObject['__pointers__'][k]['target'],
            CardinalityAssignable<TObject['__pointers__'][k]['cardinality']>
          >
    : TObject['__pointers__'][k] extends LinkDesc
    ? {} // as link, currently no type
    : any;
}> & { [key: string]: unknown };

type extractLinksToPartial<Shape extends { [key: string]: any }> = Shape extends infer T
  ? T extends object
    ? {
        [Key in keyof Shape]: Shape[Key] extends infer Link
          ? Link extends BaseObject | Array<BaseObject>
            ? boolean
            : never
          : never;
      }
    : never
  : never;

type extractMultiLinksToPartial<Shape extends { [key: string]: any }> = Shape extends infer T
  ? T extends object
    ? {
        [Key in keyof Shape]: Shape[Key] extends infer Link
          ? Link extends Array<BaseObject>
            ? boolean
            : never
          : never;
      }
    : never
  : never;

// Filter out links from model type
export type extractLinks<
  Model extends object,
  PartialLinks extends extractLinksToPartial<Model> = extractLinksToPartial<Model>,
> = PartialLinks extends infer Links
  ? {
      [K in keyof Links]: [boolean] extends [Links[K]] ? K : never;
    }[keyof Links]
  : null;
export type extractMultiLinks<
  Model extends object,
  PartialLinks extends extractMultiLinksToPartial<Model> = extractMultiLinksToPartial<Model>,
> = PartialLinks extends infer Links
  ? {
      [K in keyof Links]: [boolean] extends [Links[K]] ? K : never;
    }[keyof Links]
  : null;

type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? never
  : [S][0];

// For removing backlinks from `link` fields
// eg. SplitLT<"posts" | "comments" | "<author">  -> "posts" | "comments"
export type SplitLT<LinkOptions extends string> = Split<LinkOptions, '<'>;
// Only way to get models name is to split it on its BaseObject __name__
// eg. SplitDefault<"default::Post"> -> "Post"
export type SplitDefault<LinkOptions extends string> = Split<LinkOptions, 'default::'>;

export type EdgeDBObjectFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  Select,
  ResolveReturnShape,
> = PothosSchemaTypes.ObjectFieldOptions<
  Types,
  ParentShape,
  Type,
  Nullable,
  Args,
  ResolveReturnShape
>;

type EdgeDBObjectFieldsShape<
  Types extends SchemaTypes,
  Model extends EdgeDBModelTypes,
  Shape extends object,
> = (t: EdgeDBObjectFieldBuilder<Types, Model, Shape>) => FieldMap;

export type EdgeDBObjectTypeOptions<
  Types extends SchemaTypes,
  Interfaces extends InterfaceParam<Types>[],
  Model extends EdgeDBModelTypes,
  Shape extends object,
> = Omit<
  | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
  | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
  'fields' | 'description'
> & {
  description?: string | false;
  fields?: EdgeDBObjectFieldsShape<Types, Model, Shape>;
};

type RefForLink<
  Model extends EdgeDBModelTypes,
  Field extends keyof Model['Links'],
> = Model['Links'][Field] extends unknown[]
  ? [ObjectRef<Model['Links'][Field]>]
  : ObjectRef<Model['Links'][Field]>;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Model extends EdgeDBModelTypes,
  Field extends keyof Model['Links'],
  Nullable extends boolean,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Shape,
> = Omit<
  PothosSchemaTypes.ObjectFieldOptions<
    Types,
    Shape,
    RefForLink<Model, Field>,
    Nullable,
    Args,
    ResolveReturnShape
  >,
  'resolve' | 'type' | 'description'
> & {
  resolve?: (
    query: never,
    parent: Shape,
    args: InputShapeFromFields<Args>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<ShapeWithNullability<Types, Model['Links'][Field]['Shape'], Nullable>> & {
    type?: EdgeDBObjectRef<Model['Links'][Field]['Types']>;
  };
};

export type EdgeDBFieldResolver<
  Types extends SchemaTypes,
  Model extends EdgeDBModelTypes,
  Parent,
  Param extends TypeParam<Types>,
  Args extends InputFieldMap,
  Nullable extends FieldNullability<Param>,
  ResolveReturnShape,
> = (
  query: {},
  parent: Parent,
  args: InputShapeFromFields<Args>,
  context: Types['Context'],
  info: GraphQLResolveInfo,
) => ShapeFromTypeParam<Types, Param, Nullable> extends infer Shape
  ? [Shape] extends [[readonly (infer Item)[] | null | undefined]]
    ? ListResolveValue<Shape, Item, ResolveReturnShape>
    : MaybePromise<Shape>
  : never;

export type EdgeDBFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends
    | EdgeDBObjectRef<EdgeDBModelTypes>
    | keyof Types['EdgeDBTypes']['default']
    | [keyof Types['EdgeDBTypes']['default']]
    | [EdgeDBObjectRef<EdgeDBModelTypes>],
  Model extends EdgeDBModelTypes,
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
        ? EdgeDBFieldResolver<Types, Model, Parent, Param, Args, Nullable, ResolveReturnShape>
        : EdgeDBFieldResolver<Types, Model, ParentShape, Param, Args, Nullable, ResolveReturnShape>;
    }
  : never;
