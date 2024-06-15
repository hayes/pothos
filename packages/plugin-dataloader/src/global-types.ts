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
        Shape extends NameOrRef extends ObjectParam<Types>
          ? ShapeFromTypeParam<Types, NameOrRef, false>
          : ShapeFromLoadResult<LoadResult>,
        Key extends bigint | number | string,
        Interfaces extends InterfaceParam<Types>[],
        NameOrRef extends ObjectParam<Types> | string,
        CacheKey = Key,
        LoadResult = object,
      >(
        nameOrRef: NameOrRef,
        options: DataloaderObjectTypeOptions<
          Types,
          Shape,
          Key,
          Interfaces,
          NameOrRef,
          CacheKey,
          LoadResult
        >,
      ) => LoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableInterface: <
        Shape extends NameOrRef extends InterfaceParam<Types>
          ? ShapeFromTypeParam<Types, NameOrRef, false>
          : ShapeFromLoadResult<LoadResult>,
        Key extends bigint | number | string,
        Interfaces extends InterfaceParam<Types>[],
        NameOrRef extends InterfaceParam<Types> | string,
        CacheKey = Key,
        LoadResult = object,
      >(
        nameOrRef: NameOrRef,
        options: LoadableInterfaceOptions<
          Types,
          Shape,
          Key,
          Interfaces,
          NameOrRef,
          CacheKey,
          LoadResult
        >,
      ) => LoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableObjectRef: <
        Shape extends ShapeFromLoadResult<LoadResult>,
        Key extends bigint | number | string,
        CacheKey = Key,
        LoadResult = object,
      >(
        name: string,
        options: DataLoaderOptions<Types, Shape, Key, CacheKey, LoadResult>,
      ) => ImplementableLoadableObjectRef<Types, Key | Shape, Shape, Key, CacheKey, LoadResult>;

      loadableInterfaceRef: <
        Shape extends ShapeFromLoadResult<LoadResult>,
        Key extends bigint | number | string,
        CacheKey = Key,
        LoadResult = object,
      >(
        name: string,
        options: DataLoaderOptions<Types, Shape, Key, CacheKey, LoadResult>,
      ) => ImplementableLoadableInterfaceRef<Types, Key | Shape, Shape, Key, CacheKey, LoadResult>;

      loadableNodeRef: <
        Shape extends ShapeFromLoadResult<LoadResult>,
        IDShape extends bigint | number | string = string,
        Key extends bigint | number | string = IDShape,
        CacheKey = Key,
        LoadResult = object,
      >(
        name: string,
        options: DataLoaderOptions<Types, Shape, Key, CacheKey, LoadResult> &
          LoadableNodeId<Types, Shape, IDShape>,
      ) => ImplementableLoadableNodeRef<
        Types,
        Key | Shape,
        Shape,
        IDShape,
        Key,
        CacheKey,
        LoadResult
      >;

      loadableUnion: <
        Key extends bigint | number | string,
        Member extends ObjectParam<Types>,
        CacheKey = Key,
        Shape = ShapeFromTypeParam<Types, Member, false>,
        LoadResult = object,
      >(
        name: string,
        options: LoadableUnionOptions<Types, Key, Member, CacheKey, Shape, LoadResult>,
      ) => LoadableUnionRef<Types, Key | Shape, Shape, Key, CacheKey>;

      loadableNode: 'relay' extends PluginName
        ? <
            Shape extends NameOrRef extends ObjectParam<Types>
              ? ShapeFromTypeParam<Types, NameOrRef, false>
              : ShapeFromLoadResult<LoadResult>,
            Interfaces extends InterfaceParam<Types>[],
            NameOrRef extends ObjectParam<Types> | string,
            IDShape extends bigint | number | string = string,
            Key extends bigint | number | string = IDShape,
            CacheKey = Key,
            LoadResult = object,
          >(
            nameOrRef: NameOrRef,
            options: LoadableNodeOptions<
              Types,
              Shape,
              Interfaces,
              NameOrRef,
              IDShape,
              Key,
              CacheKey,
              LoadResult
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
        LoadResult = object,
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
          ByPath,
          LoadResult
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
        LoadResult = object,
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
          ByPath,
          LoadResult
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
