import DataLoader from 'dataloader';
import { GraphQLResolveInfo } from 'graphql';
import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputShapeFromFields,
  MaybePromise,
  OutputShape,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@giraphql/core';

export type LoadableFieldOptions<
  Types extends SchemaTypes,
  ParentShape,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  Args extends InputFieldMap,
  ResolveReturnShape,
  Key,
  CacheKey,
  Kind extends FieldKind = FieldKind
> = Omit<
  FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args, Kind, Key, ResolveReturnShape>,
  'resolve'
> & {
  load: (
    keys: Key[],
    context: Types['Context'],
  ) => Promise<(Error | LoaderShapeFromType<Types, Type, Nullable>)[]>;
  loaderOptions?: DataLoader.Options<Key, LoaderShapeFromType<Types, Type, Nullable>, CacheKey>;
  resolve: Resolver<
    ParentShape,
    InputShapeFromFields<Args>,
    Types['Context'],
    Type extends unknown[] ? Key[] : Key,
    ResolveReturnShape
  >;
};

export type DataloaderObjectTypeOptions<
  Types extends SchemaTypes,
  Shape,
  Key extends bigint | number | string,
  CacheKey
> = Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>, 'isTypeOf'> & {
  load: (keys: Key[], context: Types['Context']) => Promise<(Error | Shape)[]>;
  loaderOptions?: DataLoader.Options<Key, Shape, CacheKey>;
};

export type LoaderShapeFromType<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>
> = Type extends [TypeParam<Types>]
  ? ShapeFromTypeParam<Types, Type[0], Nullable>
  : ShapeFromTypeParam<Types, Type, Nullable>;

export interface LoadableRef<K, V, C> {
  getDataloader: (context: C) => DataLoader<K, V>;
}

export type LoadableNodeOptions<
  Types extends SchemaTypes,
  Shape extends object,
  Key extends bigint | number | string,
  CacheKey
> = DataloaderObjectTypeOptions<Types, Shape, Key, CacheKey> & {
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
  >;
  isTypeOf: (
    obj: OutputShape<Types, unknown>,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => boolean;
};
