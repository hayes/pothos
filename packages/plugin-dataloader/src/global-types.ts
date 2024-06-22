import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  ObjectParam,
  OutputType,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import { ImplementableLoadableNodeRef } from './refs';
import { ImplementableLoadableInterfaceRef, LoadableInterfaceRef } from './refs/interface';
import { ImplementableLoadableObjectRef, LoadableObjectRef } from './refs/object';
import { LoadableUnionRef } from './refs/union';
import {
  DataloaderObjectTypeOptions,
  DataLoaderOptions,
  LoadableFieldOptions,
  LoadableNodeId,
  LoadableNodeOptions,
} from './types';

import type {
  LoadableGroupFieldOptions,
  LoadableInterfaceOptions,
  LoadableListFieldOptions,
  LoadableUnionOptions,
  PothosDataloaderPlugin,
  ShapeFromLoadResult,
} from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      dataloader: PothosDataloaderPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      loadableObject: <
        LoadResult extends NameOrRef extends ObjectParam<Types>
          ? ShapeFromTypeParam<Types, NameOrRef, false> | Error
          : unknown,
        Key extends bigint | number | string,
        Interfaces extends InterfaceParam<Types>[],
        NameOrRef extends ObjectParam<Types> | string,
        CacheKey = Key,
        Shape = ShapeFromLoadResult<LoadResult>,
      >(
        nameOrRef: NameOrRef,
        options: DataloaderObjectTypeOptions<
          Types,
          LoadResult,
          Key,
          Interfaces,
          NameOrRef,
          CacheKey,
          Shape
        >,
      ) => LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableInterface: <
        LoadResult extends NameOrRef extends InterfaceParam<Types>
          ? ShapeFromTypeParam<Types, NameOrRef, false> | Error
          : unknown,
        Key extends bigint | number | string,
        Interfaces extends InterfaceParam<Types>[],
        NameOrRef extends InterfaceParam<Types> | string,
        CacheKey = Key,
        Shape = ShapeFromLoadResult<LoadResult>,
      >(
        nameOrRef: NameOrRef,
        options: LoadableInterfaceOptions<
          Types,
          LoadResult,
          Key,
          Interfaces,
          NameOrRef,
          CacheKey,
          Shape
        >,
      ) => LoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableObjectRef: <Shape, Key extends bigint | number | string, CacheKey = Key>(
        name: string,
        options: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape>,
      ) => ImplementableLoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableInterfaceRef: <Shape, Key extends bigint | number | string, CacheKey = Key>(
        name: string,
        options: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape>,
      ) => ImplementableLoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableNodeRef: <
        Shape,
        IDShape extends bigint | number | string = string,
        Key extends bigint | number | string = IDShape,
        CacheKey = Key,
      >(
        name: string,
        options: DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
          LoadableNodeId<Types, Shape, IDShape>,
      ) => ImplementableLoadableNodeRef<Types, Key | Shape, Shape, IDShape, Key, CacheKey>;

      loadableUnion: <
        Key extends bigint | number | string,
        Member extends ObjectParam<Types>,
        CacheKey = Key,
        Shape = ShapeFromTypeParam<Types, Member, false>,
      >(
        name: string,
        options: LoadableUnionOptions<Types, Key, Member, CacheKey, Shape>,
      ) => LoadableUnionRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableNode: 'relay' extends PluginName
        ? <
            LoadResult extends NameOrRef extends ObjectParam<Types>
              ? ShapeFromTypeParam<Types, NameOrRef, false> | Error
              : unknown,
            Interfaces extends InterfaceParam<Types>[],
            NameOrRef extends ObjectParam<Types> | string,
            IDShape extends bigint | number | string = string,
            Key extends bigint | number | string = IDShape,
            CacheKey = Key,
            Shape = ShapeFromLoadResult<LoadResult>,
          >(
            nameOrRef: NameOrRef,
            options: LoadableNodeOptions<
              Types,
              LoadResult,
              Interfaces,
              NameOrRef,
              IDShape,
              Key,
              CacheKey,
              Shape
            >,
          ) => Omit<
            ImplementableLoadableNodeRef<Types, Key | Shape, Shape, IDShape, Key, CacheKey>,
            'implement'
          >
        : '@pothos/plugin-relay is required to use this method';
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      loadable: <
        Args extends InputFieldMap,
        Type extends TypeParam<Types>,
        Key,
        CacheKey,
        ResolveReturnShape,
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
        ByPath extends boolean = boolean,
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
          Kind,
          ByPath
        >,
      ) => FieldRef<unknown>;
      loadableList: <
        Args extends InputFieldMap,
        Type extends OutputType<Types>,
        Key,
        CacheKey,
        ResolveReturnShape,
        Nullable extends FieldNullability<[Type]> = Types['DefaultFieldNullability'],
        ByPath extends boolean = boolean,
      >(
        options: LoadableListFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          ResolveReturnShape,
          Key,
          CacheKey,
          Kind,
          ByPath
        >,
      ) => FieldRef<unknown>;

      loadableGroup: <
        Args extends InputFieldMap,
        Type extends OutputType<Types>,
        Key,
        CacheKey,
        ResolveReturnShape,
        Nullable extends FieldNullability<[Type]> = Types['DefaultFieldNullability'],
        ByPath extends boolean = boolean,
      >(
        options: LoadableGroupFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          ResolveReturnShape,
          Key,
          CacheKey,
          Kind,
          ByPath
        >,
      ) => FieldRef<unknown>;
    }
  }
}
