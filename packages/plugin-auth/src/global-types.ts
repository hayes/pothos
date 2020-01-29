/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ShapeFromTypeParam,
  TypeParam,
  InputFields,
  FieldNullability,
  RootName,
  CompatibleInterfaceParam,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    type AuthCheck<Types extends TypeInfo, ParentShape> = (
      parent: ParentShape,
      context: Types['Context'],
    ) => boolean | Promise<boolean>;

    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      authChecks?: {
        [s: string]: AuthCheck<Types, Types['Root']>;
      };
      defaultAuthChecks?: string[];
    }

    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      authChecks?: {
        [s: string]: AuthCheck<Types, Shape>;
      };
      defaultAuthChecks?: string[];
    }

    export interface InterfaceTypeOptions<Types extends TypeInfo, Shape> {
      authChecks?: {
        [s: string]: AuthCheck<Types, Shape>;
      };
      defaultAuthChecks?: string[];
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?:
        | string
        | AuthCheck<Types, ParentShape>
        | (string | AuthCheck<Types, ParentShape>)[];
      grantAuth?: {
        [s: string]:
          | true
          | AuthCheck<
              Types,
              ReturnTypeName extends [TypeParam<Types>]
                ? ShapeFromTypeParam<Types, ReturnTypeName[0], false>
                : ShapeFromTypeParam<Types, ReturnTypeName, false>
            >;
      };
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?: (string | AuthCheck<Types, ParentShape>)[];
      grantAuth?: {
        [s: string]: true | AuthCheck<Types, ShapeFromTypeParam<Types, ReturnTypeName, false>>;
      };
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?: (string | AuthCheck<Types, ParentShape>)[];
      grantAuth?: {
        [s: string]: true | AuthCheck<Types, ShapeFromTypeParam<Types, ReturnTypeName, false>>;
      };
    }
  }
}
