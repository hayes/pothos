/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldMap,
  FieldNullability,
  InputFieldMap,
  InterfaceFieldsShape,
  InterfaceParam,
  Normalize,
  ObjectFieldsShape,
  ParentShape,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import { OutputShapeFromFields, SimpleObjectFieldsShape } from './types';

import type { PothosSimpleObjectsPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      simpleObjects: PothosSimpleObjectsPlugin<Types>;
    }
    export interface SchemaBuilder<Types extends SchemaTypes> {
      simpleObject: <
        Interfaces extends InterfaceParam<Types>[],
        Fields extends FieldMap,
        Shape extends Normalize<
          OutputShapeFromFields<Fields> & ParentShape<Types, Interfaces[number]>
        >,
      >(
        name: string,
        options: SimpleObjectTypeOptions<Types, Interfaces, Fields, Shape>,
        fields?: ObjectFieldsShape<Types, Shape>,
      ) => ObjectRef<Types, Shape>;

      simpleInterface: <
        Fields extends FieldMap,
        Shape extends OutputShapeFromFields<Fields>,
        Interfaces extends InterfaceParam<Types>[],
      >(
        name: string,
        options: SimpleInterfaceTypeOptions<Types, Fields, Shape, Interfaces>,
        fields?: InterfaceFieldsShape<Types, Shape>,
      ) => InterfaceRef<Types, Shape>;
    }

    export interface PothosKindToGraphQLType {
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
      ResolveReturnShape,
    > {
      SimpleObject: Omit<
        ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        'resolve'
      >;
      SimpleInterface: Omit<
        InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        'resolve'
      >;
    }

    export type SimpleObjectTypeOptions<
      Types extends SchemaTypes,
      Interfaces extends InterfaceParam<Types>[],
      Fields extends FieldMap,
      Shape,
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
      Interfaces extends InterfaceParam<Types>[],
    > extends Omit<InterfaceTypeOptions<Types, Shape, Interfaces>, 'args' | 'fields'> {
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    }
  }
}
