/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import {
  GraphQLResolveInfo,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
} from 'graphql';
import {
  EnumValues,
  FieldsShape,
  ShapeFromTypeParam,
  TypeParam,
  InputFields,
  Resolver,
  InputShapeFromFields,
  FieldNullability,
  RootFieldsShape,
  Subscriber,
  InputType,
  InputShapeFromField,
  RootName,
  ShapeFromType,
  InterfaceParam,
  FieldKind,
  DefaultScalars,
} from './types';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalInputFieldBuilder from './fieldUtils/input';
import Builder from './builder';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<Types extends TypeInfo> extends Builder<Types> {}

    export interface FieldBuilder<
      Types extends TypeInfo,
      ParentShape,
      Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
    > extends InternalFieldBuilder<Types, ParentShape, Kind> {}

    export interface RootFieldBuilder<
      Types extends TypeInfo,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > extends InternalRootFieldBuilder<Types, ParentShape, Kind> {}

    export interface InputFieldBuilder<Types extends TypeInfo>
      extends InternalInputFieldBuilder<Types> {}

    export interface TypeInfo {
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
      };
      Object: {};
      Root: {};
      Interface: {};
      Context: {};
    }

    export interface DefaultTypeInfo extends TypeInfo {
      Scalar: DefaultScalars;
      Object: {};
      Interface: {};
      Root: {};
      Context: {};
    }

    export interface InputOptions<
      Types extends TypeInfo,
      Type extends InputType<Types> | [InputType<Types>],
      Req extends boolean | { list: boolean; items: boolean }
    > {
      description?: string;
      required?: Req;
      default?: NonNullable<InputShapeFromField<Types, Type>>;
    }

    export interface EnumTypeOptions<Values extends EnumValues> {
      description?: string;
      values: Values;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      description?: string;
      shape?: FieldsShape<Types, Shape, 'Object'>;
      extensions?: Readonly<Record<string, unknown>>;
      implements?: undefined;
      isType?: undefined;
    }

    export interface ObjectTypeWithInterfaceOptions<
      Types extends TypeInfo,
      Shape,
      Interfaces extends InterfaceParam<Types>[]
    > extends Omit<ObjectTypeOptions<Types, Shape>, 'implements' | 'isType'> {
      implements: Interfaces;
      isType: (
        obj: ShapeFromType<Types, Interfaces[number]>,
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > {
      type: Type;
      args?: Args;
      nullable?: Nullable;
      description?: string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, unknown>>;
      resolve?: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, Type, Nullable, Args> {
      resolve: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
    }

    export interface QueryFieldOptions<
      Types extends TypeInfo,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, Types['Root'], Type, Nullable, Args> {
      resolve: Resolver<
        Types['Root'],
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
    }

    export interface MutationFieldOptions<
      Types extends TypeInfo,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, Types['Root'], Type, Nullable, Args> {
      resolve: Resolver<
        Types['Root'],
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, Type, Nullable, Args> {
      resolve?: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, Types['Root'], Type, Nullable, Args> {
      resolve: Resolver<
        Types['Root'],
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, Type, Nullable>
      >;
      subscribe: Subscriber<Types['Root'], InputShapeFromFields<Types, Args>, Types['Context']>;
    }

    export interface FieldOptionsByKind<
      Types extends TypeInfo,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>
    > {
      Query: QueryFieldOptions<Types, Type, Nullable, Args>;
      Mutation: MutationFieldOptions<Types, Type, Nullable, Args>;
      Subscription: SubscriptionFieldOptions<Types, Type, Nullable, Args>;
      Object: ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args>;
      Interface: InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args>;
    }

    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      description?: string;
      shape?: RootFieldsShape<Types, Type>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface QueryTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Query'> {}

    export interface MutationTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Mutation'> {}

    export interface SubscriptionTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Subscription'> {}

    export interface InputTypeOptions<Types extends TypeInfo, Fields extends InputFields<Types>> {
      description?: string;
      shape: (t: InputFieldBuilder<Types>) => Fields;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface InterfaceTypeOptions<Types extends TypeInfo, Shape> {
      description?: string;
      shape?: FieldsShape<Types, Shape, 'Interface'>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface UnionOptions<Types extends TypeInfo, Member extends keyof Types['Object']> {
      description?: string;
      members: Member[];
      resolveType: (
        parent: Types['Object'][Member],
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => Member | Promise<Member>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ScalarOptions<InputShape, OutputShape> {
      name: string;
      description?: string;
      // Serializes an internal value to include in a response.
      serialize: GraphQLScalarSerializer<OutputShape>;
      // Parses an externally provided value to use as an input.
      parseValue?: GraphQLScalarValueParser<InputShape>;
      // Parses an externally provided literal value to use as an input.
      parseLiteral?: GraphQLScalarLiteralParser<InputShape>;
      extensions?: Readonly<Record<string, unknown>>;
    }
  }
}
