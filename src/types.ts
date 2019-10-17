import { GraphQLEnumValueConfigMap } from 'graphql';
import InputType from './input';
import BaseType from './base';
import FieldBuilder from './fieldBuilder';
import InterfaceType from './interface';
import Field from './field';

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

export type MaybeResolver<
  Shape,
  Name extends string | number | symbol,
  Type,
  Args,
  Context
> = NeedsResolver<Shape, Name, Type> extends true
  ? Resolver<Shape, Args, Context, Type>
  : Resolver<Shape, Args, Context, Type> | undefined;

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
  FieldName extends string | number | symbol,
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
} & (NeedsResolver<
  ShapeFromTypeParam<Types, ParentName, true>,
  FieldName,
  ShapeFromTypeParam<Types, ReturnTypeName, Req>
> extends true
  ? {
      resolver: Resolver<
        ShapeFromTypeParam<Types, ParentName, true>,
        InputShapeFromFields<Args>,
        Context,
        ShapeFromTypeParam<Types, ReturnTypeName, Req>
      >;
    }
  : {
      resolver?:
        | Resolver<
            ShapeFromTypeParam<Types, ParentName, true>,
            InputShapeFromFields<Args>,
            Context,
            ShapeFromTypeParam<Types, ReturnTypeName, Req>
          >
        | undefined;
    });

export type ModifyOptions<
  Types extends TypeMap,
  ParentName extends TypeParam<Types>,
  Shape,
  Req extends boolean,
  Args extends InputFields,
  Context
> = {
  directives?: { [s: string]: unknown[] };
  description?: string;
  resolver?:
    | Resolver<
        ShapeFromTypeParam<Types, ParentName, true>,
        InputShapeFromFields<Args>,
        Context,
        Shape
      >
    | undefined;
};

export type TypeParam<Types extends TypeMap> =
  | keyof Types
  | (() => BaseType<unknown>)
  | [keyof Types]
  | (() => [BaseType<unknown>]);

export type EnumValues = { [s: number]: string } | string[] | GraphQLEnumValueConfigMap;

export type OptionalShapeFromTypeParam<
  Types extends TypeMap,
  Param extends TypeParam<Types>
> = Param extends keyof Types
  ? Types[Param]
  : Param extends () => BaseType<unknown>
  ? ReturnType<Param>['shape']
  : Param extends [keyof Types]
  ? Types[Param[0]][]
  : Param extends () => [BaseType<unknown>]
  ? ReturnType<Param>[0]['shape'][]
  : never;

export type ShapeFromTypeParam<
  Types extends TypeMap,
  Param extends TypeParam<Types>,
  Required extends boolean
> = Required extends false
  ? OptionalShapeFromTypeParam<Types, Param> | undefined | null
  : NonNullable<OptionalShapeFromTypeParam<Types, Param>>;

export type FieldsShape<Shape, Types extends TypeMap, Type extends TypeParam<Types>, Context> = {
  [K in Extract<keyof Shape, string>]: (
    t: FieldBuilder<Types, Type, K, Context>,
  ) => Field<K, Types, TypeParam<Types>, TypeParam<Types>, boolean, Context, {}>;
};

export type ObjectShapeFromInterfaces<
  Types extends TypeMap,
  Interfaces extends InterfaceType<Types, CompatibleInterfaceNames<Types, unknown>, {}, {}>[]
> = UnionToIntersection<NonNullable<Interfaces[number]['objectShape']>> & {};

export type ShapeFromInterfaces<
  Types extends TypeMap,
  Interfaces extends (InterfaceType<Types, TypeParam<Types>, {}, {}>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<Types, TypeParam<Types>, {}, {}>[]
  ? UnionToIntersection<NonNullable<Interfaces[number]['shape']>> & {}
  : never;

export type CompatibleInterfaceNames<Types extends TypeMap, Shape> = {
  [K in keyof Types]: Shape extends NonNullable<Types[K]> ? K : never;
}[keyof Types];

export type ObjectTypeOptions<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Shape extends {},
  Context,
  Interfaces extends InterfaceType<
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    {},
    {}
  >[]
> = {
  implements?: Interfaces;
  description?: string;
  check?: (obj: NonNullable<Interfaces[number]['shape']>) => boolean;
  shape: FieldsShape<Shape, Types, Type, Context>;
} & ([
  InterfaceType<
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    {},
    {}
  >,
] extends Interfaces
  ? {}
  : { check: (obj: NonNullable<Interfaces[number]['shape']>) => boolean });

export type InterfaceTypeOptions<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Shape extends {},
  Context
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
