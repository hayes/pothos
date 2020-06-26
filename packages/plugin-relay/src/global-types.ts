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
  InterfaceRef,
  ObjectFieldsShape,
  OutputShape,
  InterfaceParam,
  ObjectParam,
  ShapeFromTypeParam,
  InputFieldsFromShape,
} from '@giraphql/core';
import {
  ConnectionFieldOptions,
  ConnectionObjectOptions,
  ConnectionEdgeObjectOptions,
  ConnectionShapeFromResolve,
  PageInfoShape,
  NodeObjectOptions,
  ConnectionShapeForType,
  GlobalIDFieldOptions,
  NodeReturnShape,
  DefaultConnectionArguments,
} from './types';
import RelayPlugin from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLRelay: RelayPlugin<Types>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      pageInfoRef: () => ObjectRef<PageInfoShape>;
      nodeInterfaceRef: () => InterfaceRef<NodeReturnShape<Types>>;

      node: <Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
        param: OutputShape<Types, Param> extends NodeReturnShape<Types>
          ? Param
          : 'Type for node objects must include `id` and `__type` properties',
        options: NodeObjectOptions<Types, Param, Interfaces>,
        fields?: ObjectFieldsShape<Types, OutputShape<Types, Param>>,
      ) => ObjectRef<OutputShape<Types, Param>>;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > {
      globalID<
        Args extends InputFieldMap,
        Nullable extends FieldNullability<'ID'>,
        ResolveReturnShape
      >(
        options: GlobalIDFieldOptions<
          Types,
          ParentShape,
          'ID',
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ): FieldRef<ShapeFromTypeParam<Types, 'ID', Nullable>>;
      globalIDList<
        Args extends InputFieldMap,
        Nullable extends FieldNullability<['ID']>,
        ResolveReturnShape
      >(
        options: GlobalIDFieldOptions<
          Types,
          ParentShape,
          ['ID'],
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ): FieldRef<ShapeFromTypeParam<Types, ['ID'], Nullable>>;
      connection<
        Type extends OutputType<Types>,
        Args extends InputFieldMap,
        Nullable extends boolean,
        ResolveReturnShape
      >(
        options: Omit<
          FieldOptionsFromKind<
            Types,
            ParentShape,
            Type,
            Nullable,
            Args & InputFieldsFromShape<DefaultConnectionArguments>,
            Kind,
            ParentShape,
            ResolveReturnShape
          >,
          'type' | 'resolve' | 'args'
        > &
          ConnectionFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>,
        connectionOptions: ConnectionObjectOptions<
          Types,
          ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>
        >,
        edgeOptions: ConnectionEdgeObjectOptions<
          Types,
          ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>['edges'][number]
        >,
      ): FieldRef<ConnectionShapeForType<Types, Type, false>>;
    }
  }
}
