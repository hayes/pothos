import {
  GraphQLEnumValueConfigMap,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
} from 'graphql';
import InputType from './input';
import BaseType from './base';
import InterfaceType from './interface';
import Field from './field';
import FieldBuilder from './fieldUtils.ts/builder';
import ObjectType from './object';
import UnionType from './union';
import EnumType from './enum';
import ScalarType from './scalar';

export type TypeMap = {
  [s: string]: unknown;
  String: unknown;
  ID: unknown;
  Int: unknown;
  Float: unknown;
  Boolean: unknown;
};

export type InputField =
  | (() => InputType<unknown> | InputType<unknown>[])
  | {
      required?: boolean;
      type: () => InputType<unknown> | InputType<unknown>[];
    };

export type InputFields = {
  [s: string]: InputField;
};

export type Args<Types extends TypeMap> = {
  [s: string]: Types[keyof Types];
};

export type InputShapeFromFields<Fields extends InputFields> = {
  [K in keyof Fields]: InputShapeFromField<Fields[K]>;
};

export type MaybeRequired<Required extends boolean, Type> = Required extends true
  ? NonNullable<Type>
  : Type | null | undefined;

export type InputShapeFromField<
  Field extends InputField,
  Required extends boolean = true
> = MaybeRequired<
  Required,
  Field extends (() => InputType<unknown> | InputType<unknown>[])
    ? InputShapeFromType<Field>
    : Field extends {
        required?: infer Required;
        type: () => InputType<unknown> | InputType<unknown>[];
      }
    ? Required extends false
      ? InputShapeFromType<Field['type']> | null | undefined
      : NonNullable<InputShapeFromType<Field['type']>>
    : never
>;

export type InputShapeFromType<
  Type extends () => InputType<unknown> | InputType<unknown>[]
> = Type extends () => (infer T)[]
  ? T extends InputType<unknown>
    ? NonNullable<T['shape']>[]
    : never
  : Type extends () => infer U
  ? U extends InputType<unknown>
    ? NonNullable<U['shape']>
    : never
  : never;

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
) => Type | Promise<Type>;

export type OptionalKeys<T extends {}> = {
  [K in keyof T]: undefined extends T[K] ? K : never;
}[keyof T];

export type UndefinedToOptional<T extends {}> = Omit<T, OptionalKeys<T>> &
  Partial<Pick<T, OptionalKeys<T>>>;

export type FieldOptions<
  Types extends TypeMap,
  ParentName extends TypeParam<Types>,
  ReturnTypeName extends TypeParam<Types>,
  Req extends boolean,
  Args extends InputFields,
  Context
> = {
  type: ReturnTypeName;
  args?: Args;
  required?: Req;
  directives?: { [s: string]: unknown[] };
  description?: string;
  deprecationReason?: string;
  resolver: Resolver<
    ShapeFromTypeParam<Types, ParentName, true>,
    InputShapeFromFields<Args>,
    Context,
    ShapeFromTypeParam<Types, ReturnTypeName, Req>
  >;
};

export type NamedTypeParam<Types extends TypeMap> = Extract<keyof Types, string>;

export type TypeParam<Types extends TypeMap> =
  | keyof Types
  | (() => BaseType<Types, string, unknown>)
  | [keyof Types]
  | (() => [BaseType<Types, string, unknown>]);

export type EnumValues = { [s: number]: string } | string[] | GraphQLEnumValueConfigMap;

export type OptionalShapeFromTypeParam<
  Types extends TypeMap,
  Param extends TypeParam<Types>
> = Param extends keyof Types
  ? Types[Param]
  : Param extends () => BaseType<Types, string, unknown>
  ? ReturnType<Param>['shape']
  : Param extends [keyof Types]
  ? Types[Param[0]][]
  : Param extends () => [BaseType<Types, string, unknown>]
  ? ReturnType<Param>[0]['shape'][]
  : never;

export type ShapeFromTypeParam<
  Types extends TypeMap,
  Param extends TypeParam<Types>,
  Required extends boolean
> = Required extends false
  ? OptionalShapeFromTypeParam<Types, Param> | undefined | null
  : NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type FieldsShape<
  Shape extends {},
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Context,
  ParentShape extends {
    [s: string]: Field<
      {},
      Types,
      TypeParam<Types>,
      TypeParam<Types>,
      boolean,
      {},
      string | null,
      any
    >;
  } = {}
> = (
  t: FieldBuilder<Types, Type, Context, ParentShape>,
) => Shape &
  {
    [K in keyof Shape]: K extends keyof ParentShape
      ? Shape[K] extends Field<
          {},
          Types,
          TypeParam<Types>,
          TypeParam<Types>,
          boolean,
          Context,
          Extract<K, string>,
          any
        >
        ? Field<
            {},
            Types,
            TypeParam<Types>,
            TypeParam<Types>,
            boolean,
            Context,
            Extract<K, string>,
            any
          >
        : InvalidType<['Use t.extend(', K, ') to implement this field']>
      : Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, Context, null, any>;
  };

export type ShapeFromInterfaces<
  Types extends TypeMap,
  Interfaces extends (InterfaceType<{}, Types, NamedTypeParam<Types>>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<{}, Types, NamedTypeParam<Types>>[]
  ? UnionToIntersection<NonNullable<Interfaces[number]['shape']>> & {}
  : never;

export type CompatibleInterfaceNames<Types extends TypeMap, Shape> = Extract<
  {
    [K in keyof Types]: Shape extends NonNullable<Types[K]> ? K : never;
  }[keyof Types],
  string
>;

export type ObjectTypeOptions<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    Context
  >[],
  Types extends TypeMap,
  Type extends NamedTypeParam<Types>,
  Context = {}
> = {
  implements?: Interfaces;
  description?: string;
  shape: FieldsShape<
    Shape,
    Types,
    Type,
    Context,
    UnionToIntersection<Interfaces[number]['fields']> & {}
  >;
} & (Interfaces[number]['typename'] extends Type
  ? {}
  : {
      check: (obj: NonNullable<Interfaces[number]['shape']>) => boolean;
    });

export type InterfaceTypeOptions<
  Shape extends {},
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Context = {}
> = {
  description?: string;
  shape: FieldsShape<Shape, Types, Type, Context>;
};

// eslint-disable-next-line import/prefer-default-export
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

export type EnumTypeOptions<
  Values extends { [s: number]: string } | string[] | GraphQLEnumValueConfigMap
> = {
  description?: string;
  values: Values;
};

export type UnionOptions<Types extends TypeMap, Context, Member extends keyof Types> = {
  description?: string;
  members: Member[];
  resolveType: (parent: Types[Member], context: Context) => Member | Promise<Member>;
};

export type CompatibleTypes<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Req extends boolean,
  ParentShape = ShapeFromTypeParam<Types, ParentType, true>,
  Shape = ShapeFromTypeParam<Types, Type, Req>
> = {
  [K in keyof ParentShape]: ParentShape[K] extends Shape ? K : never;
}[keyof ParentShape];

export type ImplementedType<Types extends TypeMap> =
  | ObjectType<{}, [], Types, NamedTypeParam<Types>, {}>
  | InterfaceType<{}, Types, NamedTypeParam<Types>, {}>
  | UnionType<Types, {}, string, NamedTypeParam<Types>>
  | EnumType<Types, string>
  | ScalarType<Types, NamedTypeParam<Types>, unknown>;

export type StoreEntry<Types extends TypeMap> =
  | {
      type: ObjectType<{}, [], Types, NamedTypeParam<Types>, {}>;
      built: GraphQLObjectType;
      kind: 'Object';
    }
  | {
      type: InterfaceType<{}, Types, NamedTypeParam<Types>, {}>;
      built: GraphQLInterfaceType;
      kind: 'Interface';
    }
  | {
      type: UnionType<Types, {}, string, NamedTypeParam<Types>>;
      built: GraphQLUnionType;
      kind: 'Union';
    }
  | { type: EnumType<Types, string>; built: GraphQLEnumType; kind: 'Enum' }
  | {
      type: ScalarType<Types, NamedTypeParam<Types>, unknown>;
      built: GraphQLScalarType;
      kind: 'Scalar';
    };
