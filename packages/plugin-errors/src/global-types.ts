import type {
  AbstractReturnShape,
  FieldKind,
  FieldNullability,
  InputFieldMap,
  ObjectParam,
  ParentShape,
  SchemaTypes,
  ShapeFromListTypeParam,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosErrorsPlugin } from '.';
import type {
  ErrorFieldOptions,
  ErrorsPluginOptions,
  ErrorUnionFieldOptions,
  ErrorUnionListFieldOptions,
  ErrorUnionOptions,
} from './types';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      errors: PothosErrorsPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      errors?: ErrorsPluginOptions<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      errorUnion: <Member extends ObjectParam<Types>, ResolveType = unknown>(
        name: string,
        options: ErrorUnionOptions<Types, Member>,
      ) => UnionRef<
        Types,
        AbstractReturnShape<Types, Member, ResolveType>,
        ParentShape<Types, Member>
      >;
    }

    export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
      errors: never;
      errorOptions?: ErrorsPluginOptions<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      errors?: ErrorFieldOptions<Types, Type, ShapeFromTypeParam<Types, Type, false>, Nullable>;
      itemErrors?: Type extends [infer Item extends TypeParam<Types>]
        ? ErrorFieldOptions<Types, Item, ShapeFromTypeParam<Types, Item, false>, false>
        : never;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      errorUnionField: <
        Args extends InputFieldMap,
        Type extends ObjectParam<Types>,
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
        ResolveShape = unknown,
        ResolveReturnShape = unknown,
      >(
        options: ErrorUnionFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          Kind,
          ResolveShape,
          ResolveReturnShape
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>;
      errorUnionListField: <
        Args extends InputFieldMap,
        Type extends ObjectParam<Types>,
        Nullable extends FieldNullability<[Type]> = Types['DefaultFieldNullability'],
        ResolveShape = unknown,
        ResolveReturnShape = unknown,
      >(
        options: ErrorUnionListFieldOptions<
          Types,
          ParentShape,
          Type,
          Nullable,
          Args,
          Kind,
          ResolveShape,
          ResolveReturnShape
        >,
      ) => FieldRef<Types, ShapeFromListTypeParam<Types, [Type], Nullable>, Kind>;
    }
  }
}
