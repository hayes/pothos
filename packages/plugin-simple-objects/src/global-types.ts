import type {
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
  UnionToIntersection,
} from '@pothos/core';
import type { OutputShapeFromFields, SimpleObjectFieldsShape } from './types';

import type { PothosSimpleObjectsPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      simpleObjects: PothosSimpleObjectsPlugin<Types>;
    }
    export interface SchemaBuilder<Types extends SchemaTypes> {
      simpleObject: <
        const Interfaces extends InterfaceParam<Types>[],
        Fields extends FieldMap,
        Shape extends Normalize<
          OutputShapeFromFields<Fields> &
            UnionToIntersection<ParentShape<Types, Interfaces[number]>>
        >,
      >(
        name: string,
        options: SimpleObjectTypeOptions<Types, Interfaces, Fields, Shape>,
        fields?: ObjectFieldsShape<Types, Shape>,
      ) => ObjectRef<Types, Shape>;

      simpleInterface: <
        const Interfaces extends InterfaceParam<Types>[],
        Fields extends FieldMap,
        Shape extends Normalize<
          OutputShapeFromFields<Fields> &
            UnionToIntersection<ParentShape<Types, Interfaces[number]>>
        >,
      >(
        name: string,
        options: SimpleInterfaceTypeOptions<Types, Interfaces, Fields, Shape>,
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
      SimpleObject: ObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;

      SimpleInterface: InterfaceFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;
    }

    export type SimpleObjectTypeOptions<
      Types extends SchemaTypes,
      Interfaces extends InterfaceParam<Types>[],
      Fields extends FieldMap,
      Shape,
    > = Omit<
      ObjectTypeOptions<Types, Shape> | ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
      'fields' | 'interfaces'
    > & {
      interfaces?: (() => Interfaces) | Interfaces;
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    };

    export interface SimpleInterfaceTypeOptions<
      Types extends SchemaTypes,
      Interfaces extends InterfaceParam<Types>[],
      Fields extends FieldMap,
      Shape,
    > extends Omit<InterfaceTypeOptions<Types, Shape, Interfaces>, 'fields' | 'interfaces'> {
      interfaces?: (() => Interfaces) | Interfaces;
      fields?: SimpleObjectFieldsShape<Types, Fields>;
    }
  }
}
