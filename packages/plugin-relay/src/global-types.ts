import {
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  FieldRef,
  FieldRequiredness,
  InputFieldMap,
  InputFieldRef,
  InputFieldsFromShape,
  InputShapeFromFields,
  InputShapeFromTypeParam,
  inputShapeKey,
  InterfaceParam,
  NormalizeArgs,
  ObjectFieldsShape,
  ObjectFieldThunk,
  ObjectParam,
  OutputShape,
  OutputType,
  ParentShape,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@pothos/core';
import { NodeRef } from './node-ref';
import {
  ConnectionResultShape,
  ConnectionShape,
  ConnectionShapeForType,
  ConnectionShapeFromResolve,
  GlobalIDFieldOptions,
  GlobalIDInputFieldOptions,
  GlobalIDInputShape,
  GlobalIDListFieldOptions,
  GlobalIDListInputFieldOptions,
  GlobalIDShape,
  InputShapeWithClientMutationId,
  NodeFieldOptions,
  NodeListFieldOptions,
  NodeObjectOptions,
  PageInfoShape,
  RelayMutationFieldOptions,
  RelayMutationInputOptions,
  RelayMutationPayloadOptions,
  RelayPluginOptions,
} from './types';

import type { DefaultEdgesNullability, PothosRelayPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      relay: PothosRelayPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      relayOptions: RelayPluginOptions<Types>;
    }

    export interface UserSchemaTypes {
      Connection: {};
      DefaultEdgesNullability: FieldNullability<[unknown]>;
      DefaultNodeNullability: boolean;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      Connection: PartialTypes['Connection'] & {};
      DefaultEdgesNullability: FieldNullability<
        [unknown]
      > extends PartialTypes['DefaultEdgesNullability']
        ? DefaultEdgesNullability
        : FieldNullability<[unknown]> & PartialTypes['DefaultEdgesNullability'];
      DefaultNodeNullability: boolean extends PartialTypes['DefaultNodeNullability']
        ? false
        : PartialTypes['DefaultNodeNullability'] & boolean;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      pageInfoRef: () => ObjectRef<PageInfoShape>;
      nodeInterfaceRef: () => InterfaceRef<unknown>;

      node: <
        Interfaces extends InterfaceParam<Types>[],
        Param extends ObjectParam<Types>,
        IDShape = string,
      >(
        param: Param,
        options: NodeObjectOptions<Types, Param, Interfaces, IDShape>,
        fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>,
      ) => NodeRef<OutputShape<Types, Param>, ParentShape<Types, Param>, IDShape>;

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
        Args extends InputFieldMap = {},
      >(
        name: string,
        inputOptions:
          | InputObjectRef<unknown>
          | RelayMutationInputOptions<Types, Fields, InputName>
          | null,
        fieldOptions: RelayMutationFieldOptions<
          Types,
          Fields,
          Nullable,
          InputName,
          ResolveShape,
          ResolveReturnShape,
          Args
        >,
        payloadOptions: RelayMutationPayloadOptions<Types, ResolveShape, Interfaces>,
      ) => {
        inputType: InputObjectRef<InputShapeWithClientMutationId<Types, Fields>>;
        payloadType: ObjectRef<ResolveShape>;
      };

      connectionObject: <
        Type extends OutputType<Types>,
        ResolveReturnShape,
        EdgeNullability extends FieldNullability<[unknown]>,
        NodeNullability extends boolean,
        ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        EdgeInterfaces extends InterfaceParam<Types>[] = [],
      >(
        connectionOptions: ConnectionObjectOptions<
          Types,
          Type,
          EdgeNullability,
          NodeNullability,
          ResolveReturnShape,
          ConnectionInterfaces
        > & {
          name: string;
          type: Type;
        },
        ...args: NormalizeArgs<
          [
            edgeOptions:
              | ObjectRef<{
                  cursor: string;
                  node?: ShapeFromTypeParam<Types, Type, NodeNullability>;
                }>
              | (ConnectionEdgeObjectOptions<
                  Types,
                  Type,
                  NodeNullability,
                  ResolveReturnShape,
                  EdgeInterfaces
                > & {
                  name?: string;
                }),
          ]
        >
      ) => ObjectRef<ConnectionShapeForType<Types, Type, false, EdgeNullability, NodeNullability>>;
      edgeObject: <
        Type extends OutputType<Types>,
        ResolveReturnShape,
        NodeNullability extends boolean = Types['DefaultNodeNullability'],
        Interfaces extends InterfaceParam<Types>[] = [],
      >(
        edgeOptions: ConnectionEdgeObjectOptions<
          Types,
          Type,
          NodeNullability,
          ResolveReturnShape,
          Interfaces
        > & {
          type: Type;
          name: string;
          nodeNullable?: NodeNullability;
        },
      ) => ObjectRef<{
        cursor: string;
        node: ShapeFromTypeParam<Types, Type, NodeNullability>;
      }>;
    }

    export interface InputFieldBuilder<
      Types extends SchemaTypes,
      Kind extends 'Arg' | 'InputObject',
    > {
      connectionArgs: () => {
        [K in keyof DefaultConnectionArguments]-?: InputFieldRef<
          DefaultConnectionArguments[K],
          Kind
        >;
      };

      globalID: <Req extends boolean, For extends ObjectParam<Types>>(
        ...args: NormalizeArgs<[options: GlobalIDInputFieldOptions<Types, Req, Kind, For>]>
      ) => InputFieldRef<
        InputShapeFromTypeParam<
          Types,
          GlobalIDInputShape<For extends { parseId?: (...args: any[]) => infer T } ? T : string>,
          Req
        >,
        Kind
      >;

      globalIDList: <Req extends FieldRequiredness<['ID']>, For extends ObjectParam<Types>>(
        ...args: NormalizeArgs<[options: GlobalIDListInputFieldOptions<Types, Req, Kind, For>]>
      ) => InputFieldRef<
        InputShapeFromTypeParam<
          Types,
          [
            {
              [inputShapeKey]: {
                typename: string;
                id: For extends { parseId?: (...args: any[]) => infer T } ? T : string;
              };
            },
          ],
          Req
        >,
        Kind
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
      ) => FieldRef<readonly unknown[]>;
      connection: <
        Type extends OutputType<Types>,
        Args extends InputFieldMap,
        Nullable extends boolean,
        ResolveShape,
        ResolveReturnShape,
        EdgeNullability extends FieldNullability<[unknown]> = Types['DefaultEdgesNullability'],
        NodeNullability extends boolean = Types['DefaultNodeNullability'],
        ConnectionInterfaces extends InterfaceParam<Types>[] = [],
        EdgeInterfaces extends InterfaceParam<Types>[] = [],
        ConnectionResult extends ConnectionResultShape<
          Types,
          ShapeFromTypeParam<Types, Type, false>,
          EdgeNullability,
          NodeNullability
        > = ConnectionResultShape<
          Types,
          ShapeFromTypeParam<Types, Type, false>,
          EdgeNullability,
          NodeNullability
        >,
      >(
        options: FieldOptionsFromKind<
          Types,
          ParentShape,
          Type,
          Nullable,
          InputFieldsFromShape<DefaultConnectionArguments> &
            (InputFieldMap extends Args ? {} : Args),
          Kind,
          ResolveShape,
          ResolveReturnShape
        > extends infer FieldOptions
          ? ConnectionFieldOptions<
              Types,
              FieldOptions extends { resolve?: (parent: infer P, ...args: any[]) => unknown }
                ? P
                : unknown extends ResolveShape
                  ? ParentShape
                  : ResolveShape,
              Type,
              Nullable,
              EdgeNullability,
              NodeNullability,
              Args,
              ResolveReturnShape,
              ConnectionResult
            > &
              Omit<FieldOptions, 'args' | 'resolve' | 'type'>
          : never,
        ...args: NormalizeArgs<
          [
            connectionOptions:
              | ObjectRef<
                  ConnectionShapeForType<
                    Types,
                    Type,
                    false,
                    EdgeNullability,
                    NodeNullability,
                    ConnectionResult
                  >
                >
              | Omit<
                  ConnectionObjectOptions<
                    Types,
                    Type,
                    EdgeNullability,
                    NodeNullability,
                    ResolveReturnShape,
                    ConnectionInterfaces
                  >,
                  'edgesNullable'
                >,
            edgeOptions:
              | ConnectionEdgeObjectOptions<
                  Types,
                  Type,
                  NodeNullability,
                  ResolveReturnShape,
                  EdgeInterfaces
                >
              | ObjectRef<{
                  cursor: string;
                  node?: ShapeFromTypeParam<Types, Type, NodeNullability>;
                }>,
          ],
          0
        >
      ) => FieldRef<
        ConnectionShapeForType<Types, Type, Nullable, EdgeNullability, NodeNullability>
      >;
    }

    export interface ConnectionFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends OutputType<Types>,
      Nullable extends boolean,
      EdgeNullability extends FieldNullability<[unknown]>,
      NodeNullability extends boolean,
      Args extends InputFieldMap,
      ResolveReturnShape,
      ConnectionResult extends ConnectionResultShape<
        Types,
        ShapeFromTypeParam<Types, Type, false>,
        EdgeNullability,
        NodeNullability
      > = ConnectionResultShape<
        Types,
        ShapeFromTypeParam<Types, Type, false>,
        EdgeNullability,
        NodeNullability
      >,
    > {
      type: Type;
      args?: Args;
      edgesNullable?: EdgeNullability;
      nodeNullable?: NodeNullability;
      resolve: Resolver<
        ParentShape,
        DefaultConnectionArguments & InputShapeFromFields<Args>,
        Types['Context'],
        ConnectionShapeForType<
          Types,
          Type,
          Nullable,
          EdgeNullability,
          NodeNullability,
          ConnectionResult
        >,
        ResolveReturnShape
      >;
    }

    export interface ConnectionObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      EdgeNullability extends FieldNullability<[unknown]>,
      NodeNullability extends boolean,
      Resolved,
      Interfaces extends InterfaceParam<Types>[] = [],
      ConnectionResult extends ConnectionResultShape<
        Types,
        ShapeFromTypeParam<Types, Type, false>,
        EdgeNullability,
        NodeNullability
      > = ConnectionResultShape<
        Types,
        ShapeFromTypeParam<Types, Type, false>,
        EdgeNullability,
        NodeNullability
      >,
    > extends ObjectTypeWithInterfaceOptions<
        Types,
        ConnectionShapeFromResolve<
          Types,
          Type,
          false,
          EdgeNullability,
          NodeNullability,
          Resolved,
          ConnectionResult
        >,
        Interfaces
      > {
      name?: string;
      edgesNullable?: EdgeNullability;
      nodeNullable?: NodeNullability;
      edgesField?: Omit<
        ObjectFieldOptions<
          Types,
          {},
          ObjectRef<{}>,
          Types['DefaultNodeNullability'],
          {},
          GlobalIDShape<Types> | string
        >,
        'args' | 'nullable' | 'resolve' | 'type'
      >;
    }

    export interface ConnectionEdgeObjectOptions<
      Types extends SchemaTypes,
      Type extends OutputType<Types>,
      NodeNullability extends boolean,
      Resolved,
      Interfaces extends InterfaceParam<Types>[] = [],
    > extends ObjectTypeWithInterfaceOptions<
        Types,
        NonNullable<
          NonNullable<
            Awaited<
              ConnectionShapeFromResolve<
                Types,
                Type,
                false,
                false,
                NodeNullability,
                Resolved
              >['edges']
            >
          >[number]
        >,
        Interfaces
      > {
      name?: string;
      nodeField?: Omit<
        ObjectFieldOptions<
          Types,
          {},
          ObjectRef<{}>,
          Types['DefaultNodeNullability'],
          {},
          GlobalIDShape<Types> | string
        >,
        'args' | 'nullable' | 'resolve' | 'type'
      >;
    }

    export interface DefaultConnectionArguments {
      first?: number | null | undefined;
      last?: number | null | undefined;
      before?: string | null | undefined;
      after?: string | null | undefined;
    }

    export interface ConnectionShapeHelper<Types extends SchemaTypes, T, Nullable> {
      shape: ConnectionShape<Types, T, Nullable>;
    }
  }
}
