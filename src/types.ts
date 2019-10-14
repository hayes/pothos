import InputType from './input';
import BaseType from './base';
import FieldBuilder from './fieldBuilder';
import InterfaceType from './interface';

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
  ? Exclude<Type, null | undefined>
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
      : Exclude<InputShapeFromType<Field['type']>, null | undefined>
    : never
>;

export type InputShapeFromType<
  Type extends () => InputType<unknown> | InputType<unknown>[]
> = Type extends () => (infer T)[]
  ? T extends InputType<unknown>
    ? Exclude<T['shape'], undefined>[]
    : never
  : Type extends () => infer U
  ? U extends InputType<unknown>
    ? Exclude<U['shape'], undefined>
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
  Args extends InputFields = {},
  Context = {}
> = {
  type: ReturnTypeName;
  args?: Args;
  required?: Req;
  directives?: { [s: string]: unknown[] };
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

export type TypeParam<Types extends TypeMap> =
  | keyof Types
  | (() => BaseType<unknown>)
  | [keyof Types]
  | (() => [BaseType<unknown>]);

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
  : Exclude<OptionalShapeFromTypeParam<Types, Param>, undefined | null>;

export type ShapeOption<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  ParentShape extends {},
  Shape extends {},
  Context
> =
  | FieldBuilder<Shape, Types, Type, Context>
  | ((
      builder: FieldBuilder<ParentShape, Types, Type, Context>,
    ) => FieldBuilder<Shape, Types, Type, Context>);

export type ShapeFromOptions<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Options extends { shape: ShapeOption<Types, Type, {}, {}, {}> }
> = Options['shape'] extends () => FieldBuilder<infer T, TypeMap, string, {}>
  ? T
  : Options['shape'] extends FieldBuilder<infer U, TypeMap, string, {}>
  ? U
  : never;

export type ObjectShapeFromInterfaces<
  Types extends TypeMap,
  Interfaces extends InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[]
  ? UnionToIntersection<Exclude<Interfaces[number]['objectShape'], null | undefined>> & {}
  : never;

export type ShapeFromInterfaces<
  Types extends TypeMap,
  Interfaces extends (InterfaceType<Types, TypeParam<Types>, {}, {}, {}>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[]
  ? UnionToIntersection<Exclude<Interfaces[number]['shape'], null | undefined>> & {}
  : never;

export type CompatiblePartial<Types extends {}, Shape> = {
  [K in keyof Types]: never;
};

export type CompatibleInterfaces<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Interfaces extends (InterfaceType<Types, TypeParam<Types>, {}, {}, {}>)[] | InvalidType<unknown>
> = Interfaces extends InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[]
  ? ShapeFromTypeParam<Types, Type, true> extends ShapeFromInterfaces<Types, Interfaces>
    ? Interfaces
    : InvalidType<'Backing model must implement backing model of all interfaces'>
  : InvalidType<'Backing model must implement backing model of all interfaces'>;

export type ObjectTypeOptions<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  CheckedInterfaces extends CompatibleInterfaces<Types, Type, Interfaces>,
  ParentShape extends ObjectShapeFromInterfaces<Types, Interfaces>,
  Shape extends ParentShape,
  Context,
  Interfaces extends
    | InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[]
    | InvalidType<unknown> = CheckedInterfaces
> = {
  implements?: CheckedInterfaces;
  shape: ShapeOption<Types, Type, ParentShape, Shape, Context>;
};

export type InterfaceTypeOptions<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  ParentShape extends {},
  Shape extends ParentShape,
  Context
> = {
  shape: ShapeOption<Types, Type, ParentShape, Shape, Context>;
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
