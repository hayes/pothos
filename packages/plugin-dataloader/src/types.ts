import DataLoader from 'dataloader';
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputShapeFromFields,
  InterfaceParam,
  InterfaceRef,
  InterfaceTypeOptions,
  MaybePromise,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputRef,
  OutputShape,
  OutputType,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';

export type DataloaderKey = bigint | number | string;

export type LoadableFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Key,
  CacheKey,
  Kind extends FieldKind = FieldKind,
  ByPath extends boolean = boolean,
> = Omit<
  FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, Key, ResolveReturnShape>,
  'resolve'
> & {
  byPath?: ByPath;
  load: (
    keys: Key[],
    context: Types['Context'],
    args: false extends ByPath ? never : InputShapeFromFields<Args>,
  ) => Promise<readonly (Error | LoaderShapeFromType<Types, Type, Nullable>)[]>;
  loaderOptions?: DataLoader.Options<Key, LoaderShapeFromType<Types, Type, Nullable>, CacheKey>;
  sort?: (value: LoaderShapeFromType<Types, Type, false>) => Key;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    (Type extends unknown[] ? [OutputRef<Key>] : OutputRef<Key>) extends infer KeyType
      ? KeyType extends OutputRef | [OutputRef]
        ? ShapeFromTypeParam<
            Types,
            KeyType,
            Nullable extends FieldNullability<KeyType> ? Nullable : never
          >
        : never
      : never,
    ResolveReturnShape
  >;
};

export type LoadableListFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends OutputType<Types>,
  Nullable extends FieldNullability<[Type]>,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Key,
  CacheKey,
  Kind extends FieldKind = FieldKind,
  ByPath extends boolean = boolean,
> = Omit<
  FieldOptionsFromKind<Types, ParentShape, [Type], Nullable, Args, Kind, Key, ResolveReturnShape>,
  'resolve' | 'type'
> & {
  type: Type;
  byPath?: ByPath;
  load: (
    keys: Key[],
    context: Types['Context'],
    args: false extends ByPath ? never : InputShapeFromFields<Args>,
  ) => Promise<readonly (Error | ShapeFromTypeParam<Types, [Type], Nullable>)[]>;
  loaderOptions?: DataLoader.Options<Key, ShapeFromTypeParam<Types, [Type], Nullable>, CacheKey>;
  sort?: (value: ShapeFromTypeParam<Types, [Type], false>) => Key;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    Key,
    ResolveReturnShape
  >;
};

export type LoadableGroupFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends OutputType<Types>,
  Nullable extends FieldNullability<[Type]>,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Key,
  CacheKey,
  Kind extends FieldKind = FieldKind,
  ByPath extends boolean = boolean,
> = Omit<
  FieldOptionsFromKind<Types, ParentShape, [Type], Nullable, Args, Kind, Key, ResolveReturnShape>,
  'resolve' | 'type'
> & {
  type: Type;
  byPath?: ByPath;
  load: (
    keys: Key[],
    context: Types['Context'],
    args: false extends ByPath ? never : InputShapeFromFields<Args>,
  ) => Promise<readonly ShapeFromTypeParam<Types, Type, true>[]>;
  loaderOptions?: DataLoader.Options<Key, ShapeFromTypeParam<Types, Type, true>[], CacheKey>;
  group: (value: ShapeFromTypeParam<Types, Type, false>) => Key;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    Key,
    ResolveReturnShape
  >;
};

export type DataLoaderOptions<
  Types extends SchemaTypes,
  LoadResult,
  Key extends bigint | number | string,
  CacheKey,
  Shape = ShapeFromLoadResult<LoadResult>,
> = {
  load: (keys: Key[], context: Types['Context']) => Promise<readonly LoadResult[]>;
  loaderOptions?: DataLoader.Options<Key, Shape, CacheKey>;
} & (
  | {
      toKey: (value: Shape) => Key;
      cacheResolved?: boolean;
      sort?: boolean;
    }
  | {
      toKey?: undefined;
      cacheResolved?: (value: Shape) => Key;
      sort?: (value: Shape) => Key;
    }
);

export type DataloaderObjectTypeOptions<
  Types extends SchemaTypes,
  LoadResult,
  Key extends bigint | number | string,
  Interfaces extends InterfaceParam<Types>[],
  NameOrRef extends ObjectParam<Types> | string,
  CacheKey,
  Shape,
> = DataLoaderOptions<Types, LoadResult, Key, CacheKey, Shape> &
  ObjectTypeOptions<
    Types,
    NameOrRef extends ObjectParam<Types> ? NameOrRef : ObjectRef<Shape>,
    Shape,
    Interfaces
  >;

export type LoadableInterfaceOptions<
  Types extends SchemaTypes,
  LoadResult,
  Key extends bigint | number | string,
  Interfaces extends InterfaceParam<Types>[],
  NameOrRef extends InterfaceParam<Types> | string,
  CacheKey,
  Shape = ShapeFromLoadResult<LoadResult>,
> = DataLoaderOptions<Types, LoadResult, Key, CacheKey, Shape> &
  InterfaceTypeOptions<
    Types,
    NameOrRef extends InterfaceParam<Types> ? NameOrRef : InterfaceRef<Shape>,
    Shape,
    Interfaces
  >;

export type LoadableUnionOptions<
  Types extends SchemaTypes,
  Key extends bigint | number | string,
  Member extends ObjectParam<Types>,
  CacheKey,
  Shape,
> = DataLoaderOptions<Types, Shape | Error, Key, CacheKey, Shape> &
  PothosSchemaTypes.UnionTypeOptions<Types, Member>;

export type LoaderShapeFromType<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
> = Type extends [TypeParam<Types>]
  ? ShapeFromTypeParam<Types, Type[0], Nullable>
  : ShapeFromTypeParam<Types, Type, Nullable>;

export interface LoadableRef<K, V, C> {
  getDataloader: (context: C) => DataLoader<K, V>;
}

export interface LoadableNodeId<Types extends SchemaTypes, Shape, IDShape> {
  id: Omit<
    FieldOptionsFromKind<
      Types,
      Shape,
      'ID',
      false,
      {},
      'Object',
      Shape,
      MaybePromise<OutputShape<Types, 'ID'>>
    >,
    'args' | 'nullable' | 'type'
  > & {
    parse?: (id: string, ctx: Types['Context']) => IDShape;
  };
}

export type LoadableNodeOptions<
  Types extends SchemaTypes,
  LoadResult,
  Interfaces extends InterfaceParam<Types>[],
  NameOrRef extends ObjectParam<Types> | string,
  IDShape extends bigint | number | string = string,
  Key extends bigint | number | string = IDShape,
  CacheKey = Key,
  Shape = ShapeFromLoadResult<LoadResult>,
> = DataloaderObjectTypeOptions<Types, LoadResult, Key, Interfaces, NameOrRef, CacheKey, Shape> &
  LoadableNodeId<Types, Shape, IDShape>;

export type ShapeFromLoadResult<T> = Exclude<T, Error>;
