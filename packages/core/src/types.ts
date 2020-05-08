import {
  GraphQLEnumValueConfigMap,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLResolveInfo,
} from 'graphql';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import Field from './graphql/field';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';

import './global-types';
import QueryType from './graphql/query';
import MutationType from './graphql/mutation';
import SubscriptionType from './graphql/subscription';
import ObjectRef from './refs/object';
import InterfaceRef from './refs/interface';

export interface MergedSchemaTypes<Info extends GiraphQLSchemaTypes.TypeInfo> extends SchemaTypes {
  outputShapes: { [K in keyof Info['Object']]: Info['Object'][K] } &
    { [K in keyof Info['Interface']]: Info['Interface'][K] } &
    { [K in keyof Info['Scalar']]: Info['Scalar'][K]['Output'] };
  inputShapes: { [K in keyof Info['Scalar']]: Info['Scalar'][K]['Input'] };
  context: Info['Context'];
  root: Info['Root'];
  objects: Extract<keyof Info['Object'], string>;
  interfaces: Extract<keyof Info['Interface'], string>;
  scalars: Extract<keyof Info['Scalar'], string>;
}

export interface SchemaTypes {
  outputShapes: {
    ID: unknown;
    Int: unknown;
    Float: unknown;
    String: unknown;
    Boolean: unknown;
  };
  inputShapes: {
    ID: unknown;
    Int: unknown;
    Float: unknown;
    String: unknown;
    Boolean: unknown;
  };
  context: object;
  objects: string;
  interfaces: string;
  scalars: string;
  root: unknown;
}

export const inputShapeKey = Symbol.for('GiraphQL.inputShapeKey');
export const outputShapeKey = Symbol.for('GiraphQL.outputShapeKey');

export interface OutputRef {
  [outputShapeKey]: unknown;
  name: string;
  kind: 'Object' | 'Interface' | 'Scalar' | 'Enum' | 'Union';
}

export interface InputRef {
  [outputShapeKey]: unknown;
  name: string;
  kind: 'InputObject' | 'Scalar' | 'Enum';
}

export type OutputShape<T, Types extends SchemaTypes = SchemaTypes> = T extends {
  [outputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: unknown[]): infer U }
  ? U extends {
      [outputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['outputShapes']
  ? Types['outputShapes'][T]
  : never;

export type InputShape<T, Types extends SchemaTypes = SchemaTypes> = T extends {
  [inputShapeKey]: infer U;
}
  ? U
  : T extends { new (...args: unknown[]): infer U }
  ? U extends {
      [inputShapeKey]: infer V;
    }
    ? V
    : U
  : T extends keyof Types['inputShapes']
  ? Types['inputShapes'][T]
  : never;

export type OutputType<Types extends SchemaTypes = SchemaTypes> =
  | keyof Types['outputShapes']
  | {
      [outputShapeKey]: unknown;
    }
  | {
      new (...args: unknown[]): unknown;
    };

export type OutputTypeWithShape<Types extends SchemaTypes = SchemaTypes, Shape = unknown> =
  | NamedOutputTypeWithShape<Types, Shape>
  | {
      [outputShapeKey]: Shape;
    }
  | {
      new (...args: unknown[]): Shape;
    };

export type NamedOutputTypeWithShape<Types extends SchemaTypes, Shape> = {
  [K in keyof Types['outputShapes']]: Types['outputShapes'][K] extends Shape ? K : never;
}[keyof Types['outputShapes']];

export type TypeParam<Types extends SchemaTypes = SchemaTypes> =
  | OutputType<Types>
  | [OutputType<Types>];

export type ObjectParam<Types extends SchemaTypes, Shape = unknown> =
  | Extract<NamedOutputTypeWithShape<Types, Shape>, Types['objects']>
  | ObjectRef<unknown>
  | {
      new (...args: unknown[]): Shape;
    };

export type InterfaceParam<Types extends SchemaTypes, Shape = unknown> =
  | Extract<NamedOutputTypeWithShape<Types, Shape>, Types['interfaces']>
  | InterfaceRef<unknown>;

export type WithFieldsParam<Types extends SchemaTypes> =
  | ObjectParam<Types>
  | InterfaceParam<Types>
  | RootName;

export type ScalarName<Types extends SchemaTypes> = Types['scalars'] &
  keyof Types['outputShapes'] &
  keyof Types['inputShapes'];

export type OutputTypeRef<Shape = unknown> = {
  [outputShapeKey]: Shape;
};

export type InputType<Types extends SchemaTypes> =
  | keyof Types['outputShapes']
  | {
      [inputShapeKey]: unknown;
    };

// Utils
export type MaybePromise<T> = T | Promise<T>;

export type MaybePromiseWithInference<T, U> = U extends Promise<unknown> ? Promise<T> : T;

export type RequiredKeys<T extends object> = {
  [K in keyof T]: undefined extends T[K] ? never : null extends T[K] ? never : K;
}[keyof T];

export type NullableToOptional<T extends object> = Partial<T> &
  {
    [K in RequiredKeys<T>]: T[K];
  };

export type OptionalKeys<T> = {
  [K in keyof T]: undefined extends T[K] ? K : null extends T[K] ? K : never;
}[keyof T];

export type NormalizeNullable<T> = undefined extends T
  ? T | null | undefined
  : null extends T
  ? T | null | undefined
  : T;

export type NormalizeNullableFields<T extends object> = {
  [K in RequiredKeys<T>]: T[K];
} &
  {
    [K in OptionalKeys<T>]?: T[K] | null | undefined;
  };

export type RecursivelyNormalizeNullableFields<T> = T extends object[]
  ? ({
      [K in RequiredKeys<T[number]>]: RecursivelyNormalizeNullableFields<T[number][K]>;
    } &
      {
        [K in OptionalKeys<T[number]>]?:
          | RecursivelyNormalizeNullableFields<T[number][K]>
          | null
          | undefined;
      })[]
  : T extends unknown[]
  ? NormalizeNullable<T[number]>[]
  : T extends object
  ? {
      [K in RequiredKeys<T>]: RecursivelyNormalizeNullableFields<T[K]>;
    } &
      {
        [K in OptionalKeys<T>]?: RecursivelyNormalizeNullableFields<T[K]> | null | undefined;
      }
  : NormalizeNullable<T>;

// TypeMap
export type MergedScalars<Partial extends { [s: string]: { Input: unknown; Output: unknown } }> = {
  [K in keyof DefaultScalars]: Partial[K] extends { Input: unknown; Output: unknown }
    ? Partial[K]
    : DefaultScalars[K];
};

export interface DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: string; Output: string | number };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}

export type ShapeFromListTypeParam<
  Types extends SchemaTypes,
  Param extends [OutputType<Types>],
  Nullable extends FieldNullability<Param>
> = Nullable extends true
  ? OutputShape<Param[0], Types>[] | undefined | null
  : Nullable extends false
  ? OutputShape<Param[0], Types>[]
  : Nullable extends { list: infer List; items: infer Items }
  ? Items extends boolean
    ? List extends true
      ? OutputShape<Param[0], Types>[] | undefined | null
      : OutputShape<Param[0], Types>[]
    : never
  : never;

export type ShapeFromTypeParam<
  Types extends SchemaTypes = SchemaTypes,
  Param extends TypeParam<Types> = TypeParam<Types>,
  Nullable extends FieldNullability<Param> = FieldNullability<Param>
> = Param extends [OutputType<Types>]
  ? ShapeFromListTypeParam<Types, Param, Nullable>
  : Nullable extends true
  ? OutputShape<Param, Types> | undefined | null
  : OutputShape<Param, Types>;

export type InputField<Types extends SchemaTypes> =
  | InputType<Types>
  | InputType<Types>[]
  | {
      description?: string;
      required?: boolean;
      type: InputType<Types>;
      default?: unknown;
    }
  | {
      description?: string;
      required?: boolean | { items: boolean; list: boolean };
      type: InputType<Types>[];
      default?: unknown[];
    };

export type FieldNullability<Param = [unknown]> =
  | boolean
  | (Param extends [unknown]
      ?
          | boolean
          | {
              items: boolean;
              list: boolean;
            }
      : boolean);

export type RootName = 'Query' | 'Mutation' | 'Subscription';

export type FieldKind = keyof GiraphQLSchemaTypes.FieldOptionsByKind<
  SchemaTypes,
  {},
  TypeParam<SchemaTypes>,
  boolean,
  {},
  {},
  {}
>;

export type ScalarNameWithInputShape<Types extends SchemaTypes, Shape> = {
  [K in Types['scalars'] & keyof Types['inputShapes']]: Types['inputShapes'][K] extends Shape
    ? K
    : never;
}[Types['scalars'] & keyof Types['inputShapes']];

export type InputFields<Types extends SchemaTypes = SchemaTypes> = {
  [s: string]: InputField<Types>;
};

export type InputShapeFromFields<
  Types extends SchemaTypes,
  Fields extends InputFields<Types>,
  Nulls = null | undefined
> = NormalizeNullableFields<
  {
    [K in keyof Fields]: InputShapeFromField<Types, Fields[K], Nulls>;
  }
>;

export type InputShapeFromField<
  Types extends SchemaTypes,
  Field extends InputField<Types>,
  Nulls = null | undefined
> = Field extends InputType<Types>
  ? InputShape<Field, Types> | Nulls
  : Field extends InputType<Types>[]
  ? InputShape<Field, Types>[] | Nulls
  : Field extends {
      type: InputType<Types>;
    }
  ? InputShapeFromNonListField<Types, Field, Nulls>
  : Field extends {
      type: InputType<Types>[];
    }
  ? InputShapeFromListField<Types, Field, Nulls>
  : never;

export type InputShapeFromListField<
  Types extends SchemaTypes,
  Field extends {
    type: InputType<Types>[];
    required?: boolean | { list: boolean; items: boolean };
  },
  Nulls = null | undefined
> = Field['required'] extends true
  ? InputShape<Field['type'][number], Types>[]
  : Field['required'] extends false
  ? InputShape<Field['type'][number], Types>[] | Nulls
  : Field['required'] extends { list: infer List; items: infer Items }
  ? List extends true
    ? Items extends true
      ? InputShape<Field['type'][number], Types>[]
      : (InputShape<Field['type'][number], Types> | Nulls)[]
    : Items extends true
    ? InputShape<Field['type'][number], Types>[] | Nulls
    : (InputShape<Field['type'][number], Types> | Nulls)[] | Nulls
  : never;

export type InputShapeFromNonListField<
  Types extends SchemaTypes,
  Field extends { type: InputType<Types>; required?: boolean },
  Nulls = null | undefined
> = Field['required'] extends true
  ? InputShape<Field['type'], Types>
  : InputShape<Field['type'], Types> | Nulls;

// Resolvers
export type Resolver<Parent, Args, Context, Type, Return = unknown> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => Return &
  MaybePromiseWithInference<
    Readonly<
      | Type
      | (Type extends unknown[]
          ? Return extends MaybePromise<Promise<unknown>[]>
            ? Promise<Type[number]>[]
            : never
          : never)
    >,
    Return
  >;

export type Subscriber<Parent, Args, Context, Shape> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => AsyncIterable<Shape>;

export type EnumValues = readonly string[] | GraphQLEnumValueConfigMap;

export type ShapeFromEnumValues<Values extends EnumValues> = Values extends readonly string[]
  ? Values[number]
  : Values extends GraphQLEnumValueConfigMap
  ? {
      [K in keyof Values]: Values[K]['value'] extends string | number ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type ObjectFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => {
  [s: string]: Field;
};

export type InterfaceFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => {
  [s: string]: Field;
};

export type QueryFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['root']>,
) => {
  [s: string]: Field;
};

export type MutationFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['root']>,
) => {
  [s: string]: Field;
};

export type SubscriptionFieldsShape<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['root']>,
) => {
  [s: string]: Field;
};

export type ObjectFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.ObjectFieldBuilder<Types, Shape>,
) => Field;

export type InterfaceFieldThunk<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, Shape>,
) => Field;

export type QueryFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.QueryFieldBuilder<Types, Types['root']>,
) => Field;

export type MutationFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.MutationFieldBuilder<Types, Types['root']>,
) => Field;

export type SubscriptionFieldThunk<Types extends SchemaTypes> = (
  t: GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, Types['root']>,
) => Field;

export type FieldMap = {
  [s: string]: Field;
};

export type RootOptionsFromKind<
  Types extends SchemaTypes,
  Kind extends RootName
> = Kind extends 'Query'
  ? GiraphQLSchemaTypes.QueryTypeOptions<Types>
  : Kind extends 'Mutation'
  ? GiraphQLSchemaTypes.MutationTypeOptions<Types>
  : Kind extends 'Subscription'
  ? GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>
  : never;

export type FieldOptionsFromKind<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFields<Types>,
  Kind extends FieldKind,
  ResolveShape,
  ResolveReturnShape
> = GiraphQLSchemaTypes.FieldOptionsByKind<
  Types,
  ParentShape,
  Type,
  Nullable,
  Args,
  ResolveShape,
  ResolveReturnShape
>[Kind];

export type CompatibleInterfaceParam<Types extends SchemaTypes, Shape> = CompatibleInterfaceNames<
  Types,
  Shape
>;

// TODO add reference based interface params
// | InterfaceType<Types, CompatibleInterfaceNames<Types, Shape>>;

export type CompatibleInterfaceNames<Types extends SchemaTypes, Shape> = {
  [K in Types['interfaces'] & keyof Types['outputShapes']]: Shape extends Types['outputShapes'][K]
    ? K
    : never;
}[Types['interfaces'] & keyof Types['outputShapes']];

export type CompatibleTypes<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>
> = {
  [K in keyof ParentShape]: ParentShape[K] extends ShapeFromTypeParam<Types, Type, Nullable>
    ? K
    : never;
}[keyof ParentShape];

// All types
export type ImplementedType =
  | ObjectType
  | InterfaceType
  | UnionType
  | EnumType
  | ScalarType
  | InputObjectType
  | QueryType
  | MutationType
  | SubscriptionType;

export type BuildCacheEntryWithFields =
  | {
      type: ObjectType;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType;
      built: GraphQLInterfaceType;
      kind: 'Interface';
    }
  | {
      type: QueryType;
      built: GraphQLObjectType;
      kind: 'Query';
    }
  | {
      type: MutationType;
      built: GraphQLObjectType;
      kind: 'Mutation';
    }
  | {
      type: SubscriptionType;
      built: GraphQLObjectType;
      kind: 'Subscription';
    };

export type BuildCacheEntry =
  | BuildCacheEntryWithFields
  | {
      type: UnionType;
      built: GraphQLUnionType;
      kind: 'Union';
    }
  | { type: EnumType; built: GraphQLEnumType; kind: 'Enum' }
  | {
      type: ScalarType;
      built: GraphQLScalarType;
      kind: 'Scalar';
    }
  | {
      type: InputObjectType;
      built: GraphQLInputObjectType;
      kind: 'InputObject';
    };

export type Resolvers<Parent = unknown, Context = unknown> = {
  [s: string]:
    | Resolver<Parent, unknown, Context, unknown>
    | {
        resolve: Resolver<Parent, unknown, Context, unknown>;
        subscribe: Subscriber<Parent, unknown, Context, unknown>;
      };
};

export type ResolverMap = {
  [s: string]: Resolvers;
};
