// @ts-nocheck
import { FieldKind, FieldNullability, FieldOptionsFromKind, FieldRef, FieldRequiredness, InputFieldMap, InputFieldRef, InputFieldsFromShape, InputShapeFromTypeParam, inputShapeKey, InterfaceParam, InterfaceRef, ObjectFieldsShape, ObjectParam, ObjectRef, OutputShape, OutputType, SchemaTypes, ShapeFromTypeParam, } from '../core/index.ts';
import { ConnectionEdgeObjectOptions, ConnectionFieldOptions, ConnectionObjectOptions, ConnectionShapeForType, ConnectionShapeFromResolve, DefaultConnectionArguments, GlobalIDFieldOptions, GlobalIDInputFieldOptions, GlobalIDInputShape, GlobalIDListFieldOptions, GlobalIDListInputFieldOptions, NodeFieldOptions, NodeListFieldOptions, NodeObjectOptions, PageInfoShape, RelayPluginOptions, } from './types.ts';
import { GiraphQLRelayPlugin } from './index.ts';
declare global {
    export namespace GiraphQLSchemaTypes {
        export interface Plugins<Types extends SchemaTypes> {
            relay: GiraphQLRelayPlugin<Types>;
        }
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            relayOptions: RelayPluginOptions<Types>;
        }
        export interface SchemaBuilder<Types extends SchemaTypes> {
            pageInfoRef: () => ObjectRef<PageInfoShape>;
            nodeInterfaceRef: () => InterfaceRef<unknown>;
            node: <Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(param: Param, options: NodeObjectOptions<Types, Param, Interfaces>, fields?: ObjectFieldsShape<Types, OutputShape<Types, Param>>) => ObjectRef<OutputShape<Types, Param>>;
        }
        export interface InputFieldBuilder<Types extends SchemaTypes, Kind extends "Arg" | "InputObject"> {
            globalID: <Req extends boolean>(options: GlobalIDInputFieldOptions<Types, Req, Kind>) => InputFieldRef<InputShapeFromTypeParam<Types, GlobalIDInputShape, Req>>;
            globalIDList: <Req extends FieldRequiredness<[
                "ID"
            ]>>(options: GlobalIDListInputFieldOptions<Types, Req, Kind>) => InputFieldRef<InputShapeFromTypeParam<Types, [
                {
                    [inputShapeKey]: {
                        typename: string;
                        id: string;
                    };
                }
            ], Req>>;
        }
        export interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> {
            globalID: <Args extends InputFieldMap, Nullable extends FieldNullability<"ID">, ResolveReturnShape>(options: GlobalIDFieldOptions<Types, ParentShape, Args, Nullable, ResolveReturnShape, Kind>) => FieldRef<ShapeFromTypeParam<Types, "ID", Nullable>>;
            globalIDList: <Args extends InputFieldMap, Nullable extends FieldNullability<[
                "ID"
            ]>, ResolveReturnShape>(options: GlobalIDListFieldOptions<Types, ParentShape, Args, Nullable, ResolveReturnShape, Kind>) => FieldRef<ShapeFromTypeParam<Types, [
                "ID"
            ], Nullable>>;
            node: <Args extends InputFieldMap, ResolveShape>(options: NodeFieldOptions<Types, ParentShape, Args, ResolveShape, Kind>) => FieldRef<unknown>;
            nodeList: <Args extends InputFieldMap, ResolveShape>(options: NodeListFieldOptions<Types, ParentShape, Args, ResolveShape, Kind>) => FieldRef<unknown[]>;
            connection: <Type extends OutputType<Types>, Args extends InputFieldMap, Nullable extends boolean, ResolveReturnShape>(options: ConnectionFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape> & Omit<FieldOptionsFromKind<Types, ParentShape, Type, Nullable, Args & InputFieldsFromShape<DefaultConnectionArguments>, Kind, ParentShape, ResolveReturnShape>, "args" | "resolve" | "type">, connectionOptions: ConnectionObjectOptions<Types, ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>>, edgeOptions: ConnectionEdgeObjectOptions<Types, ConnectionShapeFromResolve<Types, Type, false, ResolveReturnShape>["edges"][number]>) => FieldRef<ConnectionShapeForType<Types, Type, false>>;
        }
    }
}
