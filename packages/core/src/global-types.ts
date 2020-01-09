/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { GraphQLResolveInfo } from 'graphql';
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
  InterfaceFieldsShape,
  InterfaceName,
  InputType,
  InputShapeFromField,
  RootName,
  DefaultTypeMap,
  MergeTypeMap,
  ShapeFromType,
  CompatibleInterfaceParam,
} from './types';
import InputFieldBuilder from './fieldUtils/input';
import Builder from './builder';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<
      PartialTypes extends PartialTypeInfo = {},
      Types extends MergeTypeMap<DefaultTypeMap, PartialTypes> = MergeTypeMap<
        DefaultTypeMap,
        PartialTypes
      >
    > extends Builder<PartialTypes, Types> {}

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
      Input: {};
      Context: {};
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
      Input?: {};
      Root?: {};
      Context?: {};
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

    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      implements?: Interfaces;
      description?: string;
      shape: FieldsShape<Types, Shape>;
      isType: Interfaces extends [InterfaceName<Types>]
        ? (
            obj: ShapeFromType<Types, Interfaces[number]>,
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) => boolean
        :
            | ((
                obj: ShapeFromType<Types, Interfaces[number]>,
                context: Types['Context'],
                info: GraphQLResolveInfo,
              ) => boolean)
            | undefined;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > {
      type: ReturnTypeName;
      args?: Args;
      nullable?: Nullable;
      description?: string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      resolve: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      resolve?: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      resolve: Resolver<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
      subscribe: Subscriber<
        ParentShape,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      description?: string;
      shape: RootFieldsShape<Types, Type>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface QueryTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Query'> {}

    export interface MutationTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Mutation'> {}

    export interface SubscriptionTypeOptions<Types extends TypeInfo>
      extends RootTypeOptions<Types, 'Subscription'> {}

    export interface InputTypeOptions<
      Types extends GiraphQLSchemaTypes.TypeInfo,
      Fields extends InputFields<Types>
    > {
      description?: string;
      shape: (t: InputFieldBuilder<Types>) => Fields;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface InterfaceTypeOptions<Types extends GiraphQLSchemaTypes.TypeInfo, Shape> {
      description?: string;
      shape: InterfaceFieldsShape<Types, Shape>;
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface UnionOptions<
      Types extends GiraphQLSchemaTypes.TypeInfo,
      Member extends keyof Types['Object']
    > {
      description?: string;
      members: Member[];
      resolveType: (
        parent: Types['Object'][Member],
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => Member | Promise<Member>;
      extensions?: Readonly<Record<string, unknown>>;
    }
  }
}
