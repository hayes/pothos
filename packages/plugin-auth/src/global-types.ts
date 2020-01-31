/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  TypeParam,
  InputFields,
  FieldNullability,
  RootName,
  CompatibleInterfaceParam,
} from '@giraphql/core';
import { AuthCheckMap, PreResolveAuthCheck, CheckAuth } from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      authChecks?: AuthCheckMap<Types, Types['Root']>;
      defaultAuthChecks?: string[];
    }

    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      preResolveAuthCheck?: PreResolveAuthCheck<Types>;
      authChecks?: AuthCheckMap<Types, Shape>;
      defaultAuthChecks?: string[];
    }

    export interface InterfaceTypeOptions<Types extends TypeInfo, Shape> {
      authChecks?: AuthCheckMap<Types, Shape>;
      defaultAuthChecks?: string[];
    }

    export interface ObjectFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?: CheckAuth<Types, ParentShape, Args>;
    }

    export interface InterfaceFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?: CheckAuth<Types, ParentShape, Args>;
    }

    export interface SubscriptionFieldOptions<
      Types extends TypeInfo,
      ParentShape,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > extends FieldOptions<Types, ReturnTypeName, Nullable, Args> {
      checkAuth?: CheckAuth<Types, ParentShape, Args>;
    }
  }
}
