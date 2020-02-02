/* eslint-disable @typescript-eslint/no-unused-vars */
import { TypeParam, InputFields, FieldNullability, RootName } from '@giraphql/core';
import { AuthCheckMap, PreResolveAuthCheck, CheckAuth } from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      authChecks?: AuthCheckMap<Types, Types['Root']>;
      defaultAuthChecks?: string[];
    }

    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      preResolveAuthCheck?: PreResolveAuthCheck<Types>;
      authChecks?: AuthCheckMap<Types, Shape>;
      defaultAuthChecks?: string[];
    }

    export interface InterfaceTypeOptions<Types extends TypeInfo, Shape> {
      authChecks?: AuthCheckMap<Types, Shape>;
      defaultAuthChecks?: string[];
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<ReturnTypeName>,
      Args extends InputFields<Types>
    > {
      // TODO add parent shape to FieldOptions
      checkAuth?: CheckAuth<Types, any, Args>;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, ReturnTypeName, Nullable, Args> {
      checkAuth?: CheckAuth<Types, ParentShape, Args>;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ParentShape, ReturnTypeName, Nullable, Args> {
      checkAuth?: CheckAuth<Types, ParentShape, Args>;
    }
  }
}
