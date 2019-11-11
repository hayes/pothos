/* eslint-disable @typescript-eslint/no-unused-vars */
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
      Context: {};
    }

    export interface InputOptions<Req extends boolean> {
      description?: string;
      required: Req;
    }

    export interface EnumTypeOptions<Values extends EnumValues> {
      description?: string;
      values: Values;
    }

    export interface ObjectTypeOptions<
      Shape extends {},
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
        Shape,
        Types,
        Type,
        UnionToIntersection<NonNullable<Interfaces[number]['fieldShape']>> & {}
      >;
      isType: Interfaces[number]['typename'] extends Type
        ? ((obj: NonNullable<Interfaces[number]['shape']>) => boolean) | undefined
        : ((obj: NonNullable<Interfaces[number]['shape']>) => boolean);
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends boolean,
      Args extends InputFields<Types>
    > {
      type: ReturnTypeName;
      args?: Args;
      nullable?: Nullable;
      directives?: { [s: string]: unknown[] };
      description?: string;
      deprecationReason?: string;
      gates?: string[];
      resolve: Resolver<
        ShapeFromTypeParam<Types, ParentName, false>,
        InputShapeFromFields<Types, Args>,
        Types['Context'],
        ShapeFromTypeParam<Types, ReturnTypeName, Nullable>
      >;
    }

    export interface InputTypeOptions<
      Types extends GiraphQLSchemaTypes.TypeInfo,
      Fields extends InputFields<Types>
    > {
      shape: (t: InputFieldBuilder<Types>) => Fields;
    }

    export interface InterfaceTypeOptions<
      Shape extends {},
      Types extends GiraphQLSchemaTypes.TypeInfo,
      Type extends TypeParam<Types>
    > {
      description?: string;
      shape: FieldsShape<Shape, Types, Type>;
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
      ) => Member | Promise<Member>;
    }
  }
}
