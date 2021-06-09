import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRef,
  FieldRequiredness,
  InputFieldMap,
  InputFieldRef,
  InputFieldsFromShape,
  InputShapeFromTypeParam,
  inputShapeKey,
  InterfaceParam,
  InterfaceRef,
  NormalizeArgs,
  ObjectFieldsShape,
  ObjectFieldThunk,
  ObjectParam,
  ObjectRef,
  OutputShape,
  OutputType,
  ParentShape,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@giraphql/core';
import {
  ConnectionEdgeObjectOptions,
  ConnectionFieldOptions,
  ConnectionObjectOptions,
  ConnectionShape,
  ConnectionShapeForType,
  ConnectionShapeFromResolve,
  DefaultConnectionArguments,
  GlobalIDFieldOptions,
  GlobalIDInputFieldOptions,
  GlobalIDInputShape,
  GlobalIDListFieldOptions,
  GlobalIDListInputFieldOptions,
  NodeFieldOptions,
  NodeListFieldOptions,
  NodeObjectOptions,
  PageInfoShape,
  RelayMutationFieldOptions,
  RelayMutationInputOptions,
  RelayMutationPayloadOptions,
  RelayPluginOptions,
} from './types';
import { GiraphQLRelayPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      relay: GiraphQLRelayPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      relayOptions: RelayPluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      Connection: {};
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      Connection: undefined extends PartialTypes['Connection']
        ? {}
        : PartialTypes['Connection'] & {};
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      pageInfoRef: () => ObjectRef<PageInfoShape>;
      nodeInterfaceRef: () => InterfaceRef<unknown>;

      node: <Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
        param: Param,
        options: NodeObjectOptions<Types, Param, Interfaces>,
        fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>,
      ) => ObjectRef<OutputShape<Types, Param>, ParentShape<Types, Param>>;

      globalConnectionFields: (
        fields: ObjectFieldsShape<Types, ConnectionShape<Types, {}, false>>,
      ) => void;

      globalConnectionField: (
        name: string,
        field: ObjectFieldThunk<Types, ConnectionShape<Types, {}, false>>,
      ) => void;

      relayMutationField: <
        Fields extends InputFieldMap,
        Nullable extends boolean,
        ResolveShape,
        ResolveReturnShape,
        Interfaces extends InterfaceParam<Types>[],
        InputName extends string = 'input',
      >(
        name: string,
        inputOptions: RelayMutationInputOptions<Types, Fields, InputName>,
        fieldOptions: RelayMutationFieldOptions<
          Types,
          Fields,
          Nullable,
          InputName,
          ResolveShape,
          ResolveReturnShape
        >,
        payloadOptions: RelayMutationPayloadOptions<Types, ResolveShape, Interfaces>,
      ) => void;
    }

    export interface InputFieldBuilder<
      Types extends SchemaTypes,
      Kind extends 'Arg' | 'InputObject',
    > {
      globalID: <Req extends boolean>(
        ...args: NormalizeArgs<[options?: GlobalIDInputFieldOptions<Types, Req, Kind>]>
      ) => InputFieldRef<InputShapeFromTypeParam<Types, GlobalIDInputShape, Req>>;

      globalIDList: <Req extends FieldRequiredness<['ID']>>(
        ...args: NormalizeArgs<[options?: GlobalIDListInputFieldOptions<Types, Req, Kind>]>
      ) => InputFieldRef<
        InputShapeFromTypeParam<
          Types,
          [
            {
              [inputShapeKey]: {
                typename: string;
                id: string;
              };
            },
          ],
          Req
        >
      >;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      globalID: <
        Args extends InputFieldMap,
        Nullable extends FieldNullability<'ID'>,
        ResolveReturnShape,
      >(
        options: GlobalIDFieldOptions<Types, ParentShape, Args, Nullable, ResolveReturnShape, Kind>,
      ) => FieldRef<ShapeFromTypeParam<Types, 'ID', Nullable>>;
      globalIDList: <
        Args extends InputFieldMap,
        Nullable extends FieldNullability<['ID']>,
        ResolveReturnShape,
      >(
        options: GlobalIDListFieldOptions<
          Types,
          ParentShape,
          Args,
          Nullable,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromTypeParam<Types, ['ID'], Nullable>>;
      node: <Args extends InputFieldMap, ResolveShape>(
        options: NodeFieldOptions<Types, ParentShape, Args, ResolveShape, Kind>,
      ) => FieldRef<unknown>;
      nodeList: <Args extends InputFieldMap, ResolveShape>(
        options: NodeListFieldOptions<Types, ParentShape, Args, ResolveShape, Kind>,
      ) => FieldRef<unknown[]>;
      connection: <
        Type extends OutputType<Types>,
        Args extends InputFieldMap,
        Nullable extends boolean,
        ResolveReturnShape,
      >(
        ...args: NormalizeArgs<
          [
            options: ConnectionFieldOptions<
              Types,
              ParentShape,
              Type,
              Nullable,
              Args,
              ResolveReturnShape
            > &
              Omit<
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
                'args' | 'resolve' | 'type'
              >,
            connectionOptions?: ConnectionObjectOptions<
              Types,
              ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>
            >,
            edgeOptions?: ConnectionEdgeObjectOptions<
              Types,
              ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>['edges'][number]
            >,
          ]
        >
      ) => FieldRef<ConnectionShapeForType<Types, Type, Nullable>>;
    }
  }
}
