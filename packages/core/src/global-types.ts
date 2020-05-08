/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import {
  GraphQLResolveInfo,
  GraphQLScalarSerializer,
  GraphQLScalarValueParser,
  GraphQLScalarLiteralParser,
  GraphQLFieldResolver,
} from 'graphql';
import {
  EnumValues,
  ShapeFromTypeParam,
  TypeParam,
  InputFields,
  Resolver,
  InputShapeFromFields,
  FieldNullability,
  Subscriber,
  InputType,
  InputShapeFromField,
  RootName,
  FieldKind,
  MergedScalars,
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  InterfaceFieldsShape,
  SchemaTypes,
  ObjectParam,
  OutputShape,
  InterfaceParam,
} from './types';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalInputFieldBuilder from './fieldUtils/input';
import Builder from './builder';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {}

    export interface FieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
    > extends InternalFieldBuilder<Types, ParentShape, Kind> {}

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > extends InternalRootFieldBuilder<Types, ParentShape, Kind> {}

    export interface QueryFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Query'> {}

    export interface MutationFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {}

    export interface SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {}

    export interface ObjectFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends FieldBuilder<Types, ParentShape, 'Object'> {}

    export interface InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends FieldBuilder<Types, ParentShape, 'Interface'> {}

    export interface InputFieldBuilder<Types extends SchemaTypes>
      extends InternalInputFieldBuilder<Types> {}

    export interface ResolverPluginData {
      parentFieldData?: GiraphQLSchemaTypes.FieldWrapData;
    }

    export interface FieldWrapData {
      resolve: GraphQLFieldResolver<unknown, object>;
    }

    export interface TypeInfo {
      Scalar: {
        [s: string]: {
          Input: unknown;
          Output: unknown;
        };
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
      Context: object;
    }

    export interface PartialTypeInfo {
      Scalar?: {
        [s: string]: {
          Input: unknown;
          Output: unknown;
        };
      };
      Object?: {};
      Interface?: {};
      Root?: {};
      Context?: {};
    }

    export interface MergedTypeMap<Partial extends GiraphQLSchemaTypes.PartialTypeInfo>
      extends SchemaTypes {
      Scalar: Partial['Scalar'] & MergedScalars<Partial['Scalar'] & {}>;
      Object: Partial['Object'] & {};
      Interface: Partial['Interface'] & {};
      Root: Partial['Root'] & {};
      Context: Partial['Context'] & {};
    }

    export interface InputOptions<
      Types extends SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>],
      Req extends boolean | { list: boolean; items: boolean }
    > {
      description?: string;
      required?: Req;
      default?: NonNullable<InputShapeFromField<Types, Type>>;
    }

    export interface EnumTypeOptions<Values extends EnumValues = EnumValues> {
      description?: string;
      values: Values;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown> {
      description?: string;
      shape?: ObjectFieldsShape<Types, Shape>;
      extensions?: Readonly<Record<string, unknown>>;
      implements?: undefined;
      isType?: undefined;
    }

    export interface ObjectTypeWithInterfaceOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[]
    > extends Omit<ObjectTypeOptions<Types, Shape>, 'implements' | 'isType'> {
      implements: Interfaces;
      isType: (
        obj: OutputShape<Interfaces[number], Types>,
        context: Types['context'],
        info: GraphQLResolveInfo,
      ) => boolean;
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFields<Types> = InputFields<Types>,
      ResolveShape = unknown,
      ResolveReturnShape = unknown
    > {
      type: Type;
      args?: Args;
      nullable?: Nullable;
      description?: string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, unknown>>;
      resolve?: Resolver<
        ResolveShape,
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface ObjectFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveReturnShape
    >
      extends FieldOptions<
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
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveReturnShape
    >
      extends FieldOptions<
        Types,
        Types['root'],
        Type,
        Nullable,
        Args,
        Types['root'],
        ResolveReturnShape
      > {
      resolve: Resolver<
        Types['root'],
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveReturnShape
    >
      extends FieldOptions<
        Types,
        Types['root'],
        Type,
        Nullable,
        Args,
        Types['root'],
        ResolveReturnShape
      > {
      resolve: Resolver<
        Types['root'],
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveReturnShape
    >
      extends FieldOptions<
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
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
    }

    export interface SubscriptionFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveShape,
      ResolveReturnShape
    >
      extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      > {
      resolve: Resolver<
        ResolveShape,
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ShapeFromTypeParam<Types, Type, Nullable>,
        ResolveReturnShape
      >;
      subscribe: Subscriber<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['context'],
        ResolveShape
      >;
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName> {
      description?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface QueryTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Query'> {
      shape?: QueryFieldsShape<Types>;
    }

    export interface MutationTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Mutation'> {
      shape?: MutationFieldsShape<Types>;
    }

    export interface SubscriptionTypeOptions<Types extends SchemaTypes = SchemaTypes>
      extends RootTypeOptions<Types, 'Subscription'> {
      shape?: SubscriptionFieldsShape<Types>;
    }

    export interface InputTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Fields extends InputFields<Types> = InputFields<Types>
    > {
      description?: string;
      shape: (t: InputFieldBuilder<Types>) => Fields;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface InterfaceTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown
    > {
      description?: string;
      shape?: InterfaceFieldsShape<Types, Shape>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface UnionOptions<
      Types extends SchemaTypes = SchemaTypes,
      Member extends ObjectParam<Types> = ObjectParam<Types>
    > {
      description?: string;
      members: Member[];
      resolveType: (
        parent: OutputShape<Member, Types>,
        context: Types['context'],
        info: GraphQLResolveInfo,
      ) => Member | Promise<Member>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ScalarOptions<InputShape = unknown, OutputShape = unknown> {
      description?: string;
      // Serializes an internal value to include in a response.
      serialize: GraphQLScalarSerializer<OutputShape>;
      // Parses an externally provided value to use as an input.
      parseValue?: GraphQLScalarValueParser<InputShape>;
      // Parses an externally provided literal value to use as an input.
      parseLiteral?: GraphQLScalarLiteralParser<InputShape>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFields<Types>,
      ResolveShape,
      ResolveReturnShape
    > {
      Query: QueryFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>;
      Mutation: MutationFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>;
      Subscription: SubscriptionFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      >;
      Object: ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>;
      Interface: GiraphQLSchemaTypes.InterfaceFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;
    }
  }
}
