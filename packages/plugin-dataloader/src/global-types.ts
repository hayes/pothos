import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  PluginName,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { DataloaderObjectTypeOptions, LoadableFieldOptions, LoadableNodeOptions } from './types';
import { LoadableObjectRef } from './util';
import { GiraphQLDataloaderPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      dataloader: GiraphQLDataloaderPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      loadableObject: <
        Shape extends object,
        Key extends bigint | number | string,
        Interfaces extends InterfaceParam<Types>[],
        CacheKey = Key
      >(
        name: string,
        options: DataloaderObjectTypeOptions<Types, Shape, Key, Interfaces, CacheKey>,
      ) => Omit<LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>, 'implement'>;

      loadableNode: 'relay' extends PluginName
        ? <
            Shape extends object,
            Key extends bigint | number | string,
            Interfaces extends InterfaceParam<Types>[],
            CacheKey = Key
          >(
            name: string,
            options: LoadableNodeOptions<Types, Shape, Key, Interfaces, CacheKey>,
          ) => Omit<LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>, 'implement'>
        : '@giraphql/plugin-relay is required to use this method';
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
