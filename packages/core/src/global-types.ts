/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { GraphQLResolveInfo } from 'graphql';
import {
  EnumValues,
  FieldsShape,
  ShapeFromTypeParam,
  CompatibleInterfaceNames,
  UnionToIntersection,
  TypeParam,
  InputFields,
  Resolver,
  InputShapeFromFields,
  ObjectName,
  FieldNullability,
  RootFieldsShape,
  Subscriber,
  InterfaceFieldsShape,
  InterfaceName,
  InputType,
  InputShapeFromField,
  RootName,
} from './types';
import InterfaceType from './graphql/interface';
import InputFieldBuilder from './fieldUtils/input';

declare global {
  export namespace GiraphQLSchemaTypes {
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
      extensions?: Readonly<Record<string, any>>;
    }

    export interface ObjectTypeOptions<
      Interfaces extends InterfaceType<
        {},
        Types,
        CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
      >[],
      Types extends TypeInfo,
      Type extends ObjectName<Types>
    > {
      implements?: Interfaces;
      description?: string;
      shape: FieldsShape<
        Types,
        Type,
        UnionToIntersection<NonNullable<Interfaces[number]['fieldShape']>> & {}
      >;
      isType: Interfaces[number]['typename'] extends Type
        ?
            | ((
                obj: NonNullable<Interfaces[number]['shape']>,
                context: Types['Context'],
                info: GraphQLResolveInfo,
              ) => boolean)
            | undefined
        : (
            obj: NonNullable<Interfaces[number]['shape']>,
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) => boolean;
      extensions?: Readonly<Record<string, any>>;
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > {
      type: ReturnTypeName;
      args?: Args;
      nullable?: Nullable;
      description?: string;
      deprecationReason?: string;
      extensions?: Readonly<Record<string, any>>;
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentName, ReturnTypeName, Nullable, Args> {
      resolve: Resolver<
        ShapeFromTypeParam<Types, ParentName, false>,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentName, ReturnTypeName, Nullable, Args> {
      resolve?: Resolver<
        ShapeFromTypeParam<Types, ParentName, false>,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentName, ReturnTypeName, Nullable, Args> {
      resolve: Resolver<
        ShapeFromTypeParam<Types, ParentName, false>,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
      subscribe: Subscriber<
        ShapeFromTypeParam<Types, ParentName, false>,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      description?: string;
      shape: RootFieldsShape<Types, Type>;
      extensions?: Readonly<Record<string, any>>;
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
      extensions?: Readonly<Record<string, any>>;
    }

    export interface InterfaceTypeOptions<
      Shape extends {},
      Types extends GiraphQLSchemaTypes.TypeInfo,
      Type extends InterfaceName<Types>
    > {
      description?: string;
      shape: InterfaceFieldsShape<Shape, Types, Type>;
      extensions?: Readonly<Record<string, any>>;
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
      extensions?: Readonly<Record<string, any>>;
    }
  }
}
