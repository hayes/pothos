/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputShapeFromFields,
  InputShapeFromTypeParam,
  InputType,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  Subscriber,
  TypeParam,
} from '../..';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      type: Type;
      args?: Args;
      nullable?: Nullable;
      description?: string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, unknown>>;
      resolve?: Resolver<
        ResolveShape,
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface ObjectFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {
      resolve: Resolver<
        ParentShape,
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        Types['Root'],
        ResolveReturnShape
      > {
      resolve: Resolver<
        Types['Root'],
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        Types['Root'],
        ResolveReturnShape
      > {
      resolve: Resolver<
        Types['Root'],
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {
      resolve?: Resolver<
        ParentShape,
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface SubscriptionFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      > {
      resolve: Resolver<
        ResolveShape,
        InputShapeFromFields<Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
      subscribe: Subscriber<
        Types['Root'],
        InputShapeFromFields<Args>,
        Types['Context'],
        ResolveShape
      >;
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      Query: QueryFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>;
      Mutation: MutationFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>;
      Subscription: SubscriptionFieldOptions<
        Types,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      >;
      Object: ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>;
      Interface: InterfaceFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > {
      type: Type;
      description?: string;
      deprecationReason?: string;
      required?: Req;
      defaultValue?: NonNullable<InputShapeFromTypeParam<Types, Type, Req>>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ArgFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > extends InputFieldOptions<Types, Type, Req> {}

    export interface InputObjectFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > extends InputFieldOptions<Types, Type, Req> {}

    export interface InputFieldOptionsByKind<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > {
      Arg: ArgFieldOptions<Types, Type, Req>;
      InputObject: InputObjectFieldOptions<Types, Type, Req>;
    }
  }
}
