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
  Input: { String: unknown; ID: unknown; Int: unknown; Float: unknown; Boolean: unknown } & {
    [K in keyof Map['Input']]: K extends keyof Partial['Input']
      ? Partial['Input'][K]
      : Map['Input'][K];
  } &
    Partial['Input'];
  Output: { String: unknown; ID: unknown; Int: unknown; Float: unknown; Boolean: unknown } & {
    [K in keyof Map['Output']]: K extends keyof Partial['Output']
      ? Partial['Output'][K]
      : Map['Output'][K];
  } &
    Partial['Output'];
  Context: Partial['Context'];
};

// TypeParam
export interface DefaultTypeMap {
  Input: {
    String: string;
    ID: string;
    Int: number;
    Float: number;
    Boolean: boolean;
  };
  Output: {
    Query: {};
    Mutation: {};
    String: string;
    ID: string | number;
    Int: number;
    Float: number;
    Boolean: boolean;
  };
  Context: {};
}

export type OptionalShapeFromTypeParam<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Param extends TypeParam<Types>
> = Param extends keyof Types['Output']
  ? Types['Output'][Param]
  : Param extends BaseType<Types, string, unknown>
  ? Param['shape']
  : Param extends [keyof Types['Output']]
  ? Types['Output'][Param[0]][]
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

export type NamedTypeParam<Types extends GiraphQLSchemaTypes.TypeInfo> = keyof Types['Output'];

export type NamedInputAndOutput<
  Types extends GiraphQLSchemaTypes.TypeInfo
> = keyof Types['Output'] & keyof Types['Input'];

export type TypeParam<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | keyof Types['Output']
  | (BaseType<Types, string, unknown>)
  | [keyof Types['Output']]
  | ([BaseType<Types, string, unknown>]);

// InputTypes
export type InputType<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputObjectType<Types, unknown, {}, string>
  | ScalarType<Types, NamedTypeParam<Types>, any, any>
  | EnumType<Types, any>
  | keyof Types['Input'];

export type InputField<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | InputType<Types>
  | InputType<Types>[]
  | {
      description?: string;
      required?: boolean;
      type: InputType<Types> | InputType<Types>[];
    };

export type InputTypeWithShape<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> =
  | InputObjectType<Types, {}, {}, string, Shape>
  | ScalarType<
      Types,
      NamedTypeParam<Types>,
      any,
      Shape extends Types['Input'][Extract<keyof Types['Output'], string>] ? Shape : never
    >
  | EnumType<Types, Shape extends string ? Shape : never>
  | {
      [K in keyof Types['Input']]: Types['Input'][K] extends Shape ? K : never;
    }[keyof Types['Input']];

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
    : T extends keyof Types['Input']
    ? NonNullable<Types['Input'][T]>[]
    : never
  : Type extends BaseType<Types, string, unknown>
  ? NonNullable<Type['inputShape']>
  : Type extends keyof Types['Input']
  ? Types['Input'][Type]
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
  Interfaces extends (InterfaceType<{}, Types, NamedTypeParam<Types>>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<{}, Types, NamedTypeParam<Types>>[]
  ? UnionToIntersection<NonNullable<Interfaces[number]['shape']>> & {}
  : never;

export type CompatibleInterfaceNames<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> = Extract<
  {
    [K in keyof Types['Output']]: Shape extends NonNullable<Types['Output'][K]> ? K : never;
  }[Exclude<keyof Types['Output'], 'Query' | 'Mutation'>],
  string
>;

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
  | InterfaceType<{}, Types, NamedTypeParam<Types>>
  | UnionType<Types, string, NamedTypeParam<Types>>
  | EnumType<Types, string, EnumValues>
  | ScalarType<Types, NamedTypeParam<Types>>
  | InputObjectType<Types, {}, {}, string>;

export type BuildCacheEntry<Types extends GiraphQLSchemaTypes.TypeInfo> =
  | {
      type: ObjectType<{}, [], Types, NamedTypeParam<Types>>;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType<{}, Types, NamedTypeParam<Types>>;
      built: GraphQLInterfaceType;
      kind: 'Interface';
    }
  | {
      type: UnionType<Types, string, NamedTypeParam<Types>>;
      built: GraphQLUnionType;
      kind: 'Union';
    }
  | { type: EnumType<Types, string>; built: GraphQLEnumType; kind: 'Enum' }
  | {
      type: ScalarType<Types, NamedTypeParam<Types>>;
      built: GraphQLScalarType;
      kind: 'Scalar';
    }
  | {
      type: InputObjectType<Types, {}, {}, string>;
      built: GraphQLInputObjectType;
      kind: 'InputObject';
    };
