/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SchemaTypes,
  ObjectRef,
  InterfaceRef,
  InputFieldMap,
  FieldNullability,
  TypeParam,
  FieldMap,
  ObjectTypeOptions as ObjectTypeOptionsWithInterfaces,
  InterfaceParam,
  OutputShape,
  ObjectParam,
} from '@giraphql/core';
import { SimpleObjectFieldsShape, OutputShapeFromFields } from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> {
      simpleObject<
        Interfaces extends InterfaceParam<Types>[],
        Fields extends FieldMap,
        Shape extends OutputShapeFromFields<Fields> & OutputShape<Types, Interfaces[number]>
      >(
        name: string,
        options: GiraphQLSchemaTypes.SimpleObjectTypeOptions<Types, Interfaces, Fields, Shape>,
      ): ObjectRef<Shape>;

      simpleInterface<
        Fields extends FieldMap,
        Shape extends OutputShapeFromFields<Fields>,
        Interfaces extends InterfaceParam<SchemaTypes>[]
      >(
        name: string,
        options: GiraphQLSchemaTypes.SimpleInterfaceTypeOptions<Types, Fields, Shape, Interfaces>,
      ): InterfaceRef<Shape>;
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
      ObjectTypeOptionsWithInterfaces<Types, ObjectParam<Types>, Shape, Interfaces>,
      'fields' | 'name' | 'args'
    > & {
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    };

    export interface SimpleInterfaceTypeOptions<
      Types extends SchemaTypes,
      Fields extends FieldMap,
      Shape extends OutputShapeFromFields<Fields>,
      Interfaces extends InterfaceParam<SchemaTypes>[]
    > extends Omit<InterfaceTypeOptions<Types, Shape, Interfaces>, 'fields' | 'args'> {
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    }
  }
}
