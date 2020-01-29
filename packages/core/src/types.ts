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
import FieldBuilder from './fieldUtils/builder';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';

import './global-types';
import RootFieldBuilder from './fieldUtils/root';
import RootType from './graphql/root';

// Utils
export type OptionalKeys<T extends {}> = {
  [K in keyof T]: undefined extends T[K] ? K : null extends T[K] ? K : never;
}[keyof T];

export type RequiredKeys<T extends {}> = {
  [K in keyof T]: undefined extends T[K] ? never : null extends T[K] ? never : K;
}[keyof T];

export type NullableToOptional<T extends {}> = Partial<T> &
  {
    [K in RequiredKeys<T>]: T[K];
  };

export type UndefinedToOptional<T extends {}> = Omit<T, OptionalKeys<T>> &
  Partial<Pick<T, OptionalKeys<T>>>;

export type MaybeRequired<Required extends boolean, Type> = Required extends true
  ? NonNullable<Type>
  : Type | null | undefined;

export abstract class InvalidType<Message> {
  never!: never;
}

export type UnknownString<T extends string | InvalidType<unknown>, Known, Message> = T extends Known
  ? InvalidType<Message>
  : T;

export type UnionToIntersection<U> = (U extends unknown
? (k: U) => void
: never) extends (k: infer I) => void
  ? I
  : never;

export type CompatibleObjectNames<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Interfaces extends InterfaceName<Types>
> = {
  [K in ObjectName<Types>]: Types['Object'][K] extends UnionToIntersection<
    Types['Interface'][Interfaces]
  >
    ? K
    : never;
}[ObjectName<Types>];

export type MaybeMerge<T, U, Condition extends boolean> = Condition extends true ? T & U : T;

export type FieldOptionsFromKind<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Types, Type>,
  Args extends InputFields<Types>,
  Kind extends 'Object' | 'Interface' | 'Root' | 'Subscription'
> = Kind extends 'Subscription'
  ? GiraphQLSchemaTypes.SubscriptionFieldOptions<Types, ParentShape, Type, Nullable, Args>
  : Kind extends 'Interface'
  ? GiraphQLSchemaTypes.InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args>
  : GiraphQLSchemaTypes.ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args>;

// TypeMap
export type MergeTypeMap<
  Map extends GiraphQLSchemaTypes.TypeInfo,
  Partial extends GiraphQLSchemaTypes.PartialTypeInfo
> = {
  Scalar: {
    String: {
      Input: unknown;
      Output: unknown;
    };
    ID: {
      Input: unknown;
      Output: unknown;
    };
    Int: {
      Input: unknown;
      Output: unknown;
    };
    Float: {
      Input: unknown;
      Output: unknown;
    };
    Boolean: {
      Input: unknown;
      Output: unknown;
    };
  } & {
    [K in keyof Map['Scalar']]: K extends keyof Partial['Scalar']
      ? Partial['Scalar'][K]
      : Map['Scalar'][K];
  } &
    Partial['Scalar'];
  Input: Exclude<Partial['Input'], undefined> & {};
  Object: Exclude<Partial['Object'], undefined> & Map['Object'];
  Interface: Exclude<Partial['Interface'], undefined> & {};
  Root: Exclude<Partial['Root'], undefined> & {};
  Context: Exclude<Partial['Context'], undefined> & {};
};

// TypeParam
export interface DefaultTypeMap {
  Scalar: {
    String: { Input: string; Output: string };
    ID: { Input: string; Output: string | number };
    Int: { Input: number; Output: number };
    Float: { Input: number; Output: number };
    Boolean: { Input: boolean; Output: boolean };
  };
  Object: {};
  Interface: {};
  Input: {};
  Root: {};
  Context: {};
}

export type OptionalShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>
> = Param extends ObjectName<Types>
  ? Types['Object'][Param]
  : Param extends InterfaceName<Types>
  ? Types['Interface'][Param]
  : Param extends ScalarName<Types>
  ? Types['Scalar'][Param]['Output']
  : Param extends BaseType<Types, string, unknown>
  ? Param['shape']
  : never;

export type ShapeFromListTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends [TypeParam<Types>],
  Nullable extends FieldNullability<Types, TypeParam<Types>>
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
  | BaseType<Types, string, unknown>;

export type ShapeFromType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends
    | ObjectName<Types>
    | InterfaceName<Types>
    | ScalarName<Types>
    | BaseType<Types, string, unknown>
> = NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type ShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>,
  Nullable extends FieldNullability<Types, Param>
> = Param extends RootName
  ? Types['Root']
  : Param extends [TypeParam<Types>]
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

export type TypeParam<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | [InterfaceName<Types>]
  | ObjectName<Types>
  | InterfaceName<Types>
  | ScalarName<Types>
  | BaseType<Types, string, unknown>
  | [ObjectName<Types>]
  | [ScalarName<Types>]
  | [BaseType<Types, string, unknown>];

// InputTypes
export type InputType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputObjectType<Types, unknown, {}, string>
  | ScalarType<Types, ScalarName<Types>>
  | EnumType<Types, string>
  | ScalarName<Types>
  | InputName<Types>;

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

export type FieldNullability<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>
> =
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

export type ObjectName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Object'] & string;

export type InputName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Input'] & string;

export type RootName = 'Query' | 'Mutation' | 'Subscription';

export type ScalarNameWithInputShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = {
  [K in keyof Types['Scalar']]: Types['Scalar'][K]['Input'] extends Shape ? K : never;
}[keyof Types['Scalar']] &
  ScalarName<Types>;

export type InputTypeWithShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> =
  | InputObjectType<Types, {}, {}, string, Shape>
  | ScalarType<Types, ScalarNameWithInputShape<Types, Shape>>
  | EnumType<Types, Shape extends string ? Shape : never>
  | ScalarNameWithInputShape<Types, Shape>
  | {
      [K in InputName<Types>]: Types['Input'][K] extends Shape ? K : never;
    }[InputName<Types>];

export type InputFieldWithShape<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Shape,
  Req extends boolean
> = {
  description?: string;
  required: Req;
  type: InputTypeWithShape<Types, NonNullable<Shape>>;
};

export type InputListFieldWithShape<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Shape extends undefined | unknown[],
  Req extends boolean | { list: boolean; items: boolean }
> = {
  description?: string;
  required: Req;
  type: InputTypeWithShape<Types, NonNullable<NonNullable<Shape>[number]>>[];
};

export type ShapedInputFields<Types extends GiraphQLSchemaTypes.TypeInfo, Shape extends {}> = {
  [K in keyof Shape]: Shape[K] extends undefined | unknown[]
    ? InputListFieldWithShape<
        Types,
        Shape[K],
        undefined | [undefined] extends Shape[K]
          ? { items: false; list: false }
          : [undefined] extends Shape[K]
          ? { items: false; list: true }
          : undefined extends Shape[K]
          ? false | { items: true; list: false }
          : true | { items: true; list: true }
      >
    : InputFieldWithShape<Types, Shape[K], undefined extends Shape[K] ? false : true>;
};

export type InputFields<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  [s: string]: InputField<Types>;
};

export type InputShapeFromFields<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Fields extends InputFields<Types>,
  Nulls = null | undefined
> = {
  [K in keyof Fields]: InputShapeFromField<Types, Fields[K], Nulls>;
};

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
> = Type extends BaseType<Types, string, unknown>
  ? NonNullable<Type['inputShape']>
  : Type extends InputName<Types>
  ? Types['Input'][Type]
  : Type extends ScalarName<Types>
  ? Types['Scalar'][Type]['Input']
  : never;

// Args
export type Args<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  [s: string]: Types[keyof Types];
};

// Resolvers
export type ResolvableValue<T> = T | Promise<T> | (() => T | Promise<T>);

export type NeedsResolver<
  Shape,
  Name extends string | number | symbol,
  Type
> = Name extends keyof Shape
  ? Shape extends { [s: string]: unknown }
    ? Shape[Name] extends ResolvableValue<Type>
      ? false
      : true
    : true
  : true;

export type Resolver<Parent, Args, Context, Type> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => Readonly<Type | Promise<Type> | (Type extends unknown[] ? Promise<Type[number]>[] : never)>;

export type Subscriber<Parent, Args, Context, Type> = (
  parent: Parent,
  args: Args,
  context: Context,
  info: GraphQLResolveInfo,
) => AsyncIterator<Type>;

export type EnumValues = readonly string[] | GraphQLEnumValueConfigMap;

export type ShapeFromEnumValues<Values extends EnumValues> = Values extends readonly string[]
  ? Values[number]
  : Values extends GraphQLEnumValueConfigMap
  ? {
      [K in keyof Values]: Values[K]['value'] extends string | number ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type FieldsShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = (
  t: FieldBuilder<Types, Shape>,
) => {
  [s: string]: Field<
    {},
    Types,
    Shape,
    TypeParam<Types>,
    FieldNullability<Types, TypeParam<Types>>,
    'Object'
  >;
};

export type RootFieldsShape<Types extends GiraphQLSchemaTypes.TypeInfo, Type extends RootName> = (
  t: RootFieldBuilder<Types, Types['Root'], Type extends 'Subscription' ? 'Subscription' : 'Root'>,
) => {
  [s: string]: Field<
    {},
    Types,
    Types['Root'],
    TypeParam<Types>,
    FieldNullability<Types, TypeParam<Types>>,
    Type extends 'Subscription' ? 'Subscription' : 'Root'
  >;
};

export type InterfaceFieldsShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = (
  t: FieldBuilder<Types, Shape, true>,
) => {
  [s: string]: Field<
    {},
    Types,
    Shape,
    TypeParam<Types>,
    FieldNullability<Types, TypeParam<Types>>,
    'Interface'
  >;
};

export type FieldMap<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  [s: string]: Field<
    {},
    Types,
    TypeParam<Types>,
    TypeParam<Types>,
    FieldNullability<Types, TypeParam<Types>>
  >;
};

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
  Nullable extends FieldNullability<Types, Type>
> = {
  [K in keyof ParentShape]: ParentShape[K] extends ShapeFromTypeParam<Types, Type, Nullable>
    ? K
    : never;
}[keyof ParentShape];

// All types
export type ImplementedType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | ObjectType<any[], Types, ObjectName<Types>>
  | InterfaceType<Types, InterfaceName<Types>>
  | UnionType<Types, string, ObjectName<Types>>
  | EnumType<Types, string, EnumValues>
  | ScalarType<Types, ScalarName<Types>>
  | InputObjectType<Types, {}, {}, string>
  | RootType<Types, 'Query' | 'Mutation'>
  | RootType<Types, 'Subscription'>;

export type BuildCacheEntry<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | {
      type: ObjectType<any[], Types, ObjectName<Types>>;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType<Types, InterfaceName<Types>>;
      built: GraphQLInterfaceType;
      kind: 'Interface';
    }
  | {
      type: UnionType<Types, string, ObjectName<Types>>;
      built: GraphQLUnionType;
      kind: 'Union';
    }
  | { type: EnumType<Types, string>; built: GraphQLEnumType; kind: 'Enum' }
  | {
      type: ScalarType<Types, ScalarName<Types>>;
      built: GraphQLScalarType;
      kind: 'Scalar';
    }
  | {
      type: InputObjectType<Types, {}, {}, string>;
      built: GraphQLInputObjectType;
      kind: 'InputObject';
    }
  | {
      type: RootType<Types, RootName>;
      built: GraphQLObjectType;
      kind: 'Root';
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
