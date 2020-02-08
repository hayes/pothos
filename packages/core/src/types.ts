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
import BaseType from './graphql/base';
import InterfaceType from './graphql/interface';
import Field from './graphql/field';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';

import './global-types';
import RootType from './graphql/root';

// Utils
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
export interface MergedTypeMap<Partial extends GiraphQLSchemaTypes.PartialTypeInfo>
  extends GiraphQLSchemaTypes.TypeInfo {
  Scalar: Partial['Scalar'] & MergedScalars<Partial['Scalar'] & {}>;
  Object: Partial['Object'] & {};
  Interface: Partial['Interface'] & {};
  Root: Partial['Root'] & {};
  Context: Partial['Context'] & {};
}

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

// Output types
export type OptionalShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>
> = Param extends ObjectName<Types>
  ? Types['Object'][Param]
  : Param extends InterfaceName<Types>
  ? Types['Interface'][Param]
  : Param extends ScalarName<Types>
  ? Types['Scalar'][Param]['Output']
  : Param extends BaseType
  ? Param['shape']
  : never;

export type ShapeFromListTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends [NonListTypeParam<Types>],
  Nullable extends FieldNullability<Param>
> = Nullable extends true
  ? ShapeFromNonListTypeParam<Types, Param[0], false>[] | undefined | null
  : Nullable extends false
  ? ShapeFromNonListTypeParam<Types, Param[0], false>[]
  : Nullable extends { list: infer List; items: infer Items }
  ? Items extends boolean
    ? List extends true
      ? ShapeFromNonListTypeParam<Types, Param[0], Items>[] | undefined | null
      : ShapeFromNonListTypeParam<Types, Param[0], Items>[]
    : never
  : never;

export type OutputType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | ObjectName<Types>
  | InterfaceName<Types>
  | ScalarName<Types>
  | BaseType;

export type ShapeFromType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends ObjectName<Types> | InterfaceName<Types> | ScalarName<Types> | BaseType
> = NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type ShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>,
  Nullable extends FieldNullability<Param>
> = Param extends RootName
  ? Types['Root']
  : Param extends [NonListTypeParam<Types>]
  ? ShapeFromListTypeParam<Types, Param, Nullable>
  : Nullable extends true
  ? OptionalShapeFromTypeParam<Types, Param> | undefined | null
  : NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type ShapeFromNonListTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>,
  Nullable extends boolean
> = Nullable extends true
  ? OptionalShapeFromTypeParam<Types, Param> | undefined | null
  : Nullable extends false
  ? NonNullable<OptionalShapeFromTypeParam<Types, Param>>
  : never;

export type NonListTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo = GiraphQLSchemaTypes.TypeInfo
> = ObjectName<Types> | InterfaceName<Types> | ScalarName<Types> | BaseType<unknown>;

export type TypeParam<Types extends GiraphQLSchemaTypes.TypeInfo = GiraphQLSchemaTypes.TypeInfo> =
  | NonListTypeParam<Types>
  | [NonListTypeParam<Types>];

// Input types
export type InputType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputObjectType<Types, {}, string>
  | ScalarType<Types, ScalarName<Types>>
  | EnumType
  | ScalarName<Types>;

export type InputObjectOfShape<Shape> = InputObjectType<
  any,
  RecursivelyNormalizeNullableFields<Shape>,
  string
>;

export type InputField<Types extends GiraphQLSchemaTypes.TypeInfo> =
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

export type ScalarName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Scalar'] & string;

export type InterfaceName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Interface'] &
  string;

export type InterfaceParam<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InterfaceName<Types>
  | InterfaceType<Types, InterfaceName<Types>>;

export type ObjectName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Object'] & string;

export type RootName = 'Query' | 'Mutation' | 'Subscription';

export type FieldKind = RootName | 'Object' | 'Interface';

export type ScalarNameWithInputShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = {
  [K in keyof Types['Scalar']]: Types['Scalar'][K]['Input'] extends Shape ? K : never;
}[keyof Types['Scalar']] &
  ScalarName<Types>;

export type InputFields<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  [s: string]: InputField<Types>;
};

export type InputShapeFromFields<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Fields extends InputFields<Types>,
  Nulls = null | undefined
> = NormalizeNullableFields<
  {
    [K in keyof Fields]: InputShapeFromField<Types, Fields[K], Nulls>;
  }
>;

export type InputShapeFromField<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Field extends InputField<Types>,
  Nulls = null | undefined
> = Field extends InputType<Types>
  ? InputShapeFromType<Types, Field>
  : Field extends InputType<Types>[]
  ? NonNullable<InputShapeFromType<Types, Field[number]>>[] | Nulls
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
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Field extends {
    type: InputType<Types>[];
    required?: boolean | { list: boolean; items: boolean };
  },
  Nulls = null | undefined
> = Field['required'] extends boolean
  ? Field['required'] extends true
    ? NonNullable<InputShapeFromType<Types, Field['type'][number]>>[]
    : InputShapeFromType<Types, Field['type'][number]>[] | Nulls
  : Field['required'] extends { list: infer List; items: infer Items }
  ? List extends true
    ? Items extends true
      ? NonNullable<InputShapeFromType<Types, Field['type'][number]>>[]
      : (InputShapeFromType<Types, Field['type'][number]> | Nulls)[]
    : Items extends true
    ? NonNullable<InputShapeFromType<Types, Field['type'][number]>>[] | Nulls
    : (InputShapeFromType<Types, Field['type'][number]> | Nulls)[] | Nulls
  : never;

export type InputShapeFromNonListField<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Field extends { type: InputType<Types>; required?: boolean },
  Nulls = null | undefined
> = Field['required'] extends true
  ? NonNullable<InputShapeFromType<Types, Field['type']>>
  : InputShapeFromType<Types, Field['type']> | Nulls;

export type InputShapeFromType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends InputType<Types>
> = Type extends BaseType
  ? NonNullable<Type['inputShape']>
  : Type extends ScalarName<Types>
  ? Types['Scalar'][Type]['Input']
  : never;

// Resolvers
export type Resolver<Parent, Args, Context, Type> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => Readonly<Type | Promise<Type> | (Type extends unknown[] ? Promise<Type[number]>[] : never)>;

export type Subscriber<Parent, Args, Context> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => AsyncIterator<unknown>;

export type EnumValues = readonly string[] | GraphQLEnumValueConfigMap;

export type ShapeFromEnumValues<Values extends EnumValues> = Values extends readonly string[]
  ? Values[number]
  : Values extends GraphQLEnumValueConfigMap
  ? {
      [K in keyof Values]: Values[K]['value'] extends string | number ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type FieldsShape<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Shape,
  Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
> = (
  t: GiraphQLSchemaTypes.FieldBuilder<Types, Shape, Kind>,
) => {
  [s: string]: Field<{}, Types, TypeParam<Types>>;
};

export type RootFieldsShape<Types extends GiraphQLSchemaTypes.TypeInfo, Kind extends RootName> = (
  t: GiraphQLSchemaTypes.RootFieldBuilder<Types, Types['Root'], Kind>,
) => {
  [s: string]: Field<{}, Types, TypeParam<Types>>;
};

export type FieldMap = {
  [s: string]: Field<{}, any, TypeParam>;
};

export type FieldOptionsFromKind<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFields<Types>,
  Kind extends FieldKind
> = Kind extends 'Query' | 'Mutation' | 'Object'
  ? GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args>
  : Kind extends 'Interface'
  ? GiraphQLSchemaTypes.InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args>
  : GiraphQLSchemaTypes.SubscriptionFieldOptions<Types, ParentShape, Type, Nullable, Args>;

export type CompatibleInterfaceParam<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> =
  | CompatibleInterfaceNames<Types, Shape>
  | InterfaceType<Types, CompatibleInterfaceNames<Types, Shape>>;

export type CompatibleInterfaceNames<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = {
  [K in InterfaceName<Types>]: Shape extends NonNullable<Types['Interface'][K]> ? K : never;
}[InterfaceName<Types>] &
  InterfaceName<Types>;

export type CompatibleTypes<
  Types extends GiraphQLSchemaTypes.TypeInfo,
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
  | ObjectType<any>
  | InterfaceType<any, InterfaceName<any>, any>
  | UnionType<any, any>
  | EnumType
  | ScalarType<any, any>
  | InputObjectType<any, {}, string>
  | RootType<any, 'Query' | 'Mutation'>
  | RootType<any, 'Subscription'>;

export type BuildCacheEntryWithFields =
  | {
      type: ObjectType<any>;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType<any, any>;
      built: GraphQLInterfaceType;
      kind: 'Interface';
    }
  | {
      type: RootType<any, RootName>;
      built: GraphQLObjectType;
      kind: 'Root';
    };

export type BuildCacheEntry =
  | BuildCacheEntryWithFields
  | {
      type: UnionType<any, any>;
      built: GraphQLUnionType;
      kind: 'Union';
    }
  | { type: EnumType; built: GraphQLEnumType; kind: 'Enum' }
  | {
      type: ScalarType<any, any>;
      built: GraphQLScalarType;
      kind: 'Scalar';
    }
  | {
      type: InputObjectType<any, {}, string>;
      built: GraphQLInputObjectType;
      kind: 'InputObject';
    };

export type Resolvers<Parent = unknown, Context = unknown> = {
  [s: string]:
    | Resolver<Parent, unknown, Context, unknown>
    | {
        resolve: Resolver<Parent, unknown, Context, unknown>;
        subscribe: Subscriber<Parent, unknown, Context>;
      };
};

export type ResolverMap = {
  [s: string]: Resolvers;
};
