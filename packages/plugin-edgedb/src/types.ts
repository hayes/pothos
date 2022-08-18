import type { Client } from 'edgedb';
import {
  FieldMap,
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  InterfaceParam,
  MaybePromise,
  Normalize,
  ObjectRef,
  SchemaTypes,
  ShapeWithNullability,
  TypeParam,
} from '@pothos/core';
import type { EdgeDBObjectFieldBuilder } from './edgedb-field-builder';
import { GraphQLResolveInfo } from 'graphql';

export interface EdgeDBQueryBuilder {
  default: unknown;
}
export interface EdgeDBDriver extends Client {}

export type EdgeDBModels<
  Name extends EdgeDBTypeKeys,
  Types extends SchemaTypes = SchemaTypes,
> = Types['EdgeDBTypes']['default'][Name] extends infer T ? T : never;

export type EdgeDBTypeKeys<Types extends SchemaTypes = SchemaTypes> =
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

type EdgeDBDefaultExportKey<
  DefaultExports,
  KeyType extends string | number | symbol = EdgeDBDefaultExportKeyTypes<DefaultExports>,
> = Extract<keyof DefaultExports, KeyType>;

export type EdgeDBModelTypes<Types extends SchemaTypes> =
  Types['EdgeDBTypes']['default'] extends infer ObjectTypeMap
    ? ObjectTypeMap extends object
      ? ObjectTypeMap
      : never
    : never;

export type EdgeDBModelShape<
  Types extends SchemaTypes,
  Name extends EdgeDBTypeKeys<Types>,
> = EdgeDBModelTypes<Types>[Name] extends infer Property
  ? Property extends BaseObject & EdgeDBModelTypes<Types>[Name]
    ? Property & {
        Fields: extractLinks<Property> extends infer Field
          ? Field extends string
            ? SplitLT<Field>
            : null
          : never;
        Links: {
          [Key in Property['Fields']]: {
            Shape: Property['Fields'][Key] extends infer Shape
              ? Shape extends BaseObject
                ? Shape
                : Shape extends Array<BaseObject>
                ? Shape[0]
                : never
              : never;
          };
        };
      }
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
export type cardinalityAssignable<C extends Cardinality> = C extends Cardinality.Empty
  ? Cardinality.Empty
  : C extends Cardinality.One
  ? Cardinality.One
  : C extends Cardinality.AtMostOne
  ? Cardinality.One | Cardinality.AtMostOne | Cardinality.Empty
  : C extends Cardinality.AtLeastOne
  ? Cardinality.One | Cardinality.AtLeastOne | Cardinality.Many
  : C extends Cardinality.Many
  ? Cardinality
  : never;

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

type pointersToObjectType<P extends ObjectTypePointers> = ObjectType<string, P, {}>;

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
            cardinalityAssignable<TObject['__pointers__'][k]['cardinality']>
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

// Extract links from queryBuilder object, not from type
// Shape extends infer T
//  ? T extends TypeSet<ObjectType>
//   ? {
//       [K in keyof T['__element__']['__pointers__']]: T['__element__']['__pointers__'][K] extends LinkDesc
//         ? boolean
//         : never;
//     }
//   : never
// : never;

// Filter out links from model type
export type extractLinks<
  Model extends object,
  PartialLinks extends extractLinksToPartial<Model> = extractLinksToPartial<Model>,
> = PartialLinks extends infer Links
  ? {
      [K in keyof Links]: [boolean] extends [Links[K]] ? K : never;
    }[keyof Links]
  : null;

type Split<S extends string, D extends string> = S extends `${infer T}${D}${infer U}`
  ? never
  : [S][0];

// For removing backlinks from `link` fields
// eg. fields: "posts" | "comments" | "<author"  -> fields: "posts" | "comments"
export type SplitLT<LinkOptions extends string> = Split<LinkOptions, '<'>;

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
  Model extends
    | ({
        [key: string]: Model[keyof Model] extends infer U ? U : never;
      } & {
        Fields: string | never;
        Links: {
          [Key in Model['Fields']]: { Shape: Model['Links'][Key] };
        };
      })
    | never,
  Shape extends object = Extract<Model, 'Links' & 'Fields'>,
> = (t: EdgeDBObjectFieldBuilder<Types, Model, Shape>) => FieldMap;

export type EdgeDBObjectTypeOptions<
  Types extends SchemaTypes,
  Interfaces extends InterfaceParam<Types>[],
  Model extends
    | ({
        [key: string]: Model[keyof Model] extends infer U ? U : never;
      } & {
        Fields: string | never;
        Links: {
          [Key in Model['Fields']]: { Shape: Model['Links'][Key] };
        };
      })
    | never,
> = Omit<
  | PothosSchemaTypes.ObjectTypeOptions<Types, Model>
  | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Model, Interfaces>,
  'fields' | 'description'
> & {
  description?: string | false;
  fields?: EdgeDBObjectFieldsShape<Types, Model>;
};

type RefForLink<
  Model extends
    | ({ [ModelKey in keyof Model]: Model[ModelKey] extends infer U ? U : never } & {
        Fields: string | never;
        Links: {
          [Key in Model['Fields']]: { Shape: Model['Links'][Key] };
        };
      })
    | never,
  Field extends keyof Model['Links'],
> = Model['Links'][Field] extends unknown[]
  ? [ObjectRef<Model['Links'][Field]>]
  : ObjectRef<Model['Links'][Field]>;

export type RelatedFieldOptions<
  Types extends SchemaTypes,
  Model extends
    | ({ [ModelKey in keyof Model]: Model[ModelKey] extends infer U ? U : never } & {
        Fields: string | never;
        Links: {
          [Key in Model['Fields']]: { Shape: Model['Links'][Key] };
        };
      })
    | never,
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
  ) => MaybePromise<ShapeWithNullability<Types, Field, Nullable>>;
};
