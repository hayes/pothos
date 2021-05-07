import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  ObjectRef,
  OutputShape,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { DataloaderObjectTypeOptions, LoadableFieldOptions } from './types';
import { GiraphQLDataloaderPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      dataloader: GiraphQLDataloaderPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      loadableObject: <
        Interfaces extends InterfaceParam<Types>[],
        Shape extends OutputShape<Types, Interfaces[number]> & object,
        Key extends bigint | number | string,
        CacheKey = Key
      >(
        name: string,
        options: DataloaderObjectTypeOptions<Types, Interfaces, Shape, Key, CacheKey>,
      ) => ObjectRef<Key | Shape>;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > {
      loadable: <
        Args extends InputFieldMap,
        Type extends TypeParam<Types>,
        Key,
        CacheKey,
        ResolveReturnShape,
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability']
      >(
        options: LoadableFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          ResolveReturnShape,
          Key,
          CacheKey,
          Kind
        >,
      ) => FieldRef<unknown>;
    }
  }
}
