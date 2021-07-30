import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  ObjectRef,
  SchemaTypes,
} from '@giraphql/core';
import {
  DelegateFromName,
  ModelName,
  PrismaFieldOptions,
  PrismaObjectTypeOptions,
  ShapeFromPrismaDelegate,
} from './types';
import { PrismaPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      prisma: PrismaPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      prisma: {
        client: Types['PrismaClient'];
      };
    }

    export interface UserSchemaTypes {
      PrismaClient: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      PrismaClient: undefined extends PartialTypes['PrismaClient']
        ? {}
        : PartialTypes['PrismaClient'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      prismaObject: <
        Name extends ModelName<Types>,
        Interfaces extends InterfaceParam<Types>[],
        FindUnique,
      >(
        type: Name,
        options: PrismaObjectTypeOptions<Types, Name, Interfaces, FindUnique>,
      ) => ObjectRef<{}>;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      prismaField: <
        Args extends InputFieldMap,
        TypeParam extends ModelName<Types> | [ModelName<Types>],
        Name extends TypeParam extends [ModelName<Types>]
          ? TypeParam[0]
          : TypeParam extends ModelName<Types>
          ? TypeParam
          : never,
        Type extends DelegateFromName<Types, Name>,
        Nullable extends FieldNullability<
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromPrismaDelegate<Type>>]
            : ObjectRef<ShapeFromPrismaDelegate<Type>>
        >,
        ResolveReturnShape,
      >(
        options: PrismaFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          TypeParam extends [Name]
            ? [ObjectRef<ShapeFromPrismaDelegate<Type>>]
            : ObjectRef<ShapeFromPrismaDelegate<Type>>,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromPrismaDelegate<Type>>;
    }
  }
}
