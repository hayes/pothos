/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SchemaTypes,
  InputFieldMap,
  FieldNullability,
  FieldKind,
  OutputType,
  FieldOptionsFromKind,
  ObjectRef,
  FieldRef,
} from '@giraphql/core';
import {
  ConnectionFieldOptions,
  ConnectionObjectOptions,
  ConnectionEdgeObjectOptions,
  ConnectionShapeFromResolve,
  PageInfoShape,
} from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> {
      pageInfoRef: () => ObjectRef<PageInfoShape>;
    }

    // export interface FieldOptionsByKind<
    //   Types extends SchemaTypes,
    //   ParentShape,
    //   Type extends TypeParam<Types>,
    //   Nullable extends FieldNullability<Type>,
    //   Args extends InputFieldMap,
    //   ResolveShape,
    //   ResolveReturnShape
    // > {}

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > {
      connection<
        Type extends OutputType<Types>,
        Args extends InputFieldMap,
        Nullable extends FieldNullability<Type>,
        ResolveReturnShape
      >(
        options: Omit<
          FieldOptionsFromKind<
            Types,
            ParentShape,
            Type,
            Nullable,
            Args,
            Kind,
            ParentShape,
            ResolveReturnShape
          >,
          'type' | 'resolve'
        > &
          ConnectionFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        connectionOptions: ConnectionObjectOptions<
          Types,
          ConnectionShapeFromResolve<Types, Type, Nullable, ResolveReturnShape>
        >,
        edgeOptions: ConnectionEdgeObjectOptions<
          Types,
          ConnectionShapeFromResolve<Types, Type, Nullable, ResolveReturnShape>['edges'][number]
        >,
      ): FieldRef<unknown>; // TODO type this correctly
    }
  }
}
