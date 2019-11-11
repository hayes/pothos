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
import Field from './field';
import FieldBuilder from './fieldUtils/builder';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';

import './global-types';

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

export type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends ((
  k: infer I,
) => void)
  ? I
  : never;

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
  Context: Partial['Context'];
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
  Object: {
    Query: {};
    Mutation: {};
  };
  Interface: {};
  Input: {};
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
  : Param extends [ObjectName<Types>]
  ? Types['Object'][Param[0]][]
  : Param extends [InterfaceName<Types>]
  ? Types['Interface'][Param[0]][]
  : Param extends [ScalarName<Types>]
  ? Types['Scalar'][Param[0]]['Output'][]
  : Param extends [BaseType<Types, string, unknown>]
  ? Param[0]['shape'][]
  : never;

export type ShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>,
  Nullable extends boolean
> = Nullable extends true
  ? OptionalShapeFromTypeParam<Types, Param> | undefined | null
  : NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type TypeParam<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | ObjectName<Types>
  | InterfaceName<Types>
  | ScalarName<Types>
  | (BaseType<Types, string, unknown>)
  | [ObjectName<Types>]
  | [InterfaceName<Types>]
  | [ScalarName<Types>]
  | ([BaseType<Types, string, unknown>]);

// InputTypes
export type InputType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputObjectType<Types, unknown, {}, string>
  | ScalarType<Types, ScalarName<Types>>
  | EnumType<Types, any>
  | ScalarName<Types>
  | InputName<Types>;

export type InputField<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputType<Types>
  | InputType<Types>[]
  | {
      description?: string;
      required?: boolean;
      type: InputType<Types> | InputType<Types>[];
    };

export type ScalarName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Scalar'] & string;

export type InterfaceName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Interface'] &
  string;

export type ObjectName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Object'] & string;

export type InputName<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Input'] & string;

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
  type: Shape extends unknown[]
    ? InputTypeWithShape<Types, NonNullable<Shape[number]>>[]
    : InputTypeWithShape<Types, NonNullable<Shape>>;
};

export type ShapedInputFields<Types extends GiraphQLSchemaTypes.TypeInfo, Shape extends {}> = {
  [K in keyof Shape]: InputFieldWithShape<
    Types,
    Shape[K],
    undefined extends Shape[K] ? false : true
  >;
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
> = Field extends (InputType<Types> | InputType<Types>[])
  ? InputShapeFromType<Types, Field>
  : Field extends {
      required?: infer Required;
      type: InputType<Types> | InputType<Types>[];
    }
  ? Required extends true
    ? NonNullable<InputShapeFromType<Types, Field['type']>>
    : InputShapeFromType<Types, Field['type']> | Nulls
  : never;

export type InputShapeFromType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends InputType<Types> | InputType<Types>[],
  Nulls = null | undefined
> = Type extends (infer T)[]
  ? T extends BaseType<Types, string, unknown>
    ? NonNullable<T['inputShape']>[]
    : T extends InputName<Types>
    ? NonNullable<Types['Input'][T]>[]
    : never
  : Type extends BaseType<Types, string, unknown>
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
) => Type extends any[]
  ? Promise<Readonly<Type[number]>>[] | Readonly<Type | Promise<Type>>
  : Readonly<Type | Promise<Type>>;

export type EnumValues = (readonly string[]) | GraphQLEnumValueConfigMap;

export type ShapeFromEnumValues<Values extends EnumValues> = Values extends readonly string[]
  ? Values[number]
  : Values extends GraphQLEnumValueConfigMap
  ? {
      [K in keyof Values]: Values[K]['value'] extends string | number ? Values[K]['value'] : K;
    }[keyof Values]
  : never;

export type FieldsShape<
  Shape extends {},
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends TypeParam<Types>,
  ParentShape extends {
    [s: string]: Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, string | null, any>;
  } = {}
> = (
  t: FieldBuilder<Types, Type, ParentShape>,
) => Shape &
  {
    [K in keyof Shape]: K extends keyof ParentShape
      ? Shape[K] extends Field<
          {},
          Types,
          TypeParam<Types>,
          TypeParam<Types>,
          boolean,
          Extract<K, string>,
          any
        >
        ? Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, Extract<K, string>, any>
        : InvalidType<['Use t.extend(', K, ') to implement this field']>
      : Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, null, any>;
  };

export type FieldMap<Types extends GiraphQLSchemaTypes.TypeInfo> = {
  [s: string]: Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, null, any>;
};

export type ShapeFromInterfaces<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Interfaces extends (InterfaceType<{}, Types, InterfaceName<Types>>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<{}, Types, InterfaceName<Types>>[]
  ? UnionToIntersection<NonNullable<Interfaces[number]['shape']>> & {}
  : never;

export type CompatibleInterfaceNames<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = {
  [K in InterfaceName<Types>]: Shape extends NonNullable<Types['Interface'][K]> ? K : never;
}[InterfaceName<Types>] &
  InterfaceName<Types>;

export type CompatibleTypes<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Req extends boolean,
  ParentShape = ShapeFromTypeParam<Types, ParentType, false>,
  Shape = ShapeFromTypeParam<Types, Type, Req>
> = {
  [K in keyof ParentShape]: ParentShape[K] extends Shape ? K : never;
}[keyof ParentShape];

// All types
export type ImplementedType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | ObjectType<{}, any[], Types, any>
  | InterfaceType<{}, Types, InterfaceName<Types>>
  | UnionType<Types, string, ObjectName<Types>>
  | EnumType<Types, string, EnumValues>
  | ScalarType<Types, ScalarName<Types>>
  | InputObjectType<Types, {}, {}, string>;

export type BuildCacheEntry<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | {
      type: ObjectType<{}, [], Types, ObjectName<Types>>;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType<{}, Types, InterfaceName<Types>>;
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
    };
