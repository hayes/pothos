/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldMap,
  FieldNullability,
  InputFieldMap,
  InterfaceParam,
  InterfaceRef,
  ObjectRef,
  OutputShape,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { OutputShapeFromFields, SimpleObjectFieldsShape } from './types';
import { GiraphQLSimpleObjectsPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      simpleObjects: GiraphQLSimpleObjectsPlugin<Types>;
    }
    export interface SchemaBuilder<Types extends SchemaTypes> {
      simpleObject: <
        Interfaces extends InterfaceParam<Types>[],
        Fields extends FieldMap,
        Shape extends OutputShape<Types, Interfaces[number]> & OutputShapeFromFields<Fields>
      >(
        name: string,
        options: SimpleObjectTypeOptions<Types, Interfaces, Fields, Shape>,
      ) => ObjectRef<Shape>;

      simpleInterface: <
        Fields extends FieldMap,
        Shape extends OutputShapeFromFields<Fields>,
        Interfaces extends InterfaceParam<SchemaTypes>[]
      >(
        name: string,
        options: SimpleInterfaceTypeOptions<Types, Fields, Shape, Interfaces>,
      ) => InterfaceRef<Shape>;
    }

    export interface GiraphQLKindToGraphQLType {
      SimpleObject: 'Object';
      SimpleInterface: 'Interface';
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape
    > {
      SimpleObject: Omit<
        ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        'resolve'
      > & {
        parent?: (parent: ParentShape) => void;
      };
      SimpleInterface: Omit<
        InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        'resolve'
      >;
    }

    export type SimpleObjectTypeOptions<
      Types extends SchemaTypes,
      Interfaces extends InterfaceParam<Types>[],
      Fields extends FieldMap,
      Shape extends OutputShapeFromFields<Fields>
    > = Omit<
      ObjectTypeOptions<Types, Shape> | ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
      'fields'
    > & {
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    };

    export interface SimpleInterfaceTypeOptions<
      Types extends SchemaTypes,
      Fields extends FieldMap,
      Shape extends OutputShapeFromFields<Fields>,
      Interfaces extends InterfaceParam<SchemaTypes>[]
    > extends Omit<InterfaceTypeOptions<Types, Shape, Interfaces>, 'args' | 'fields'> {
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    }
  }
}
