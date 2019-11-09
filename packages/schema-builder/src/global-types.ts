/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  EnumValues,
  FieldsShape,
  NamedTypeParam,
  ShapeFromTypeParam,
  CompatibleInterfaceNames,
  UnionToIntersection,
} from './types';
import InterfaceType from './interface';

declare global {
  export namespace SpiderSchemaTypes {
    export interface TypeInfo {
      Input: {
        String: unknown;
        ID: unknown;
        Int: unknown;
        Float: unknown;
        Boolean: unknown;
      };
      Output: {
        String: unknown;
        ID: unknown;
        Int: unknown;
        Float: unknown;
        Boolean: unknown;
      };
      Context: {};
    }

    export interface PartialTypeInfo {
      Input?: {};
      Output?: {};
      Context: {};
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
      Type extends NamedTypeParam<Types>
    > {
      implements?: Interfaces;
      description?: string;
      shape: FieldsShape<
        Shape,
        Types,
        Type,
        UnionToIntersection<Interfaces[number]['fields']> & {}
      >;
      isType: Interfaces[number]['typename'] extends Type
        ? ((obj: NonNullable<Interfaces[number]['shape']>) => boolean) | undefined
        : ((obj: NonNullable<Interfaces[number]['shape']>) => boolean);
    }
  }
}
