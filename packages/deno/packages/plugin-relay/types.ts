// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { ArgumentRef, EmptyToOptional, FieldKind, FieldNullability, FieldOptionsFromKind, FieldRequiredness, InputFieldMap, InputFieldRef, InputFieldsFromShape, InputRef, InputShapeFromFields, inputShapeKey, InterfaceParam, MaybePromise, Normalize, ObjectFieldsShape, ObjectParam, ObjectRef, ObjectTypeOptions, OutputRef, OutputRefShape, OutputShape, OutputType, ParentShape, Resolver, SchemaTypes, ShapeFromListTypeParam, ShapeFromTypeParam, } from '../core/index.ts';
export type RelayPluginOptions<Types extends SchemaTypes> = EmptyToOptional<{
    idFieldName?: string;
    idFieldOptions?: Partial<Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, "ID", boolean, {}, PageInfoShape>, "args" | "nullable" | "resolve" | "type">>;
    clientMutationId?: "omit" | "optional" | "required";
    cursorType?: "ID" | "String";
    edgeCursorType?: "ID" | "String";
    pageInfoCursorType?: "ID" | "String";
    brandLoadedObjects?: boolean;
    nodeTypeOptions: Omit<PothosSchemaTypes.InterfaceTypeOptions<Types, unknown>, "fields">;
    pageInfoTypeOptions: Omit<PothosSchemaTypes.ObjectTypeOptions<Types, PageInfoShape>, "fields">;
    nodeQueryOptions: false | (Omit<PothosSchemaTypes.QueryFieldOptions<Types, OutputRefShape<GlobalIDShape<Types> | string>, boolean, {
        id: ArgumentRef<Types, {
            typename: string;
            id: string;
        }>;
    }, Promise<unknown>>, "args" | "resolve" | "type"> & {
        args?: {
            id?: Omit<GlobalIDInputFieldOptions<Types, true, "Arg", ObjectParam<Types>>, "required">;
        };
        resolve?: (parent: Types["Root"], args: {
            id: {
                typename: string;
                id: string;
            };
        }, context: Types["Context"], info: GraphQLResolveInfo, resolveNode: (id: {
            typename: string;
            id: string;
        }) => MaybePromise<unknown>) => MaybePromise<unknown>;
    });
    nodesQueryOptions: false | (Omit<PothosSchemaTypes.QueryFieldOptions<Types, [
        OutputRefShape<GlobalIDShape<Types> | string>
    ], FieldNullability<[
        unknown
    ]>, {
        ids: ArgumentRef<Types, {
            typename: string;
            id: string;
        }[]>;
    }, Promise<unknown>[]>, "args" | "resolve" | "type"> & {
        args?: {
            ids?: Omit<GlobalIDListInputFieldOptions<Types, true, "Arg", ObjectParam<Types>>, "required">;
        };
        resolve?: (parent: Types["Root"], args: {
            ids: {
                typename: string;
                id: string;
            }[];
        }, context: Types["Context"], info: GraphQLResolveInfo, resolveNodes: (ids: {
            id: string;
            typename: string;
        }[]) => Promise<unknown[]>) => MaybePromise<readonly MaybePromise<unknown>[]>;
    });
    mutationInputArgOptions: Omit<PothosSchemaTypes.ArgFieldOptions<Types, InputRef<{}>, boolean>, "fields" | "type">;
    clientMutationIdInputOptions: Omit<PothosSchemaTypes.InputObjectFieldOptions<Types, "ID", boolean>, "type">;
    clientMutationIdFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, "ID", boolean, {}, Types["Scalars"]["ID"]["Output"]>, "args" | "resolve" | "type">;
    cursorFieldOptions: Normalize<Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, "ID" | "String", false, {}, Types["Scalars"]["ID" | "String"]["Output"]>, "args" | "resolve" | "type"> & {
        type?: "ID" | "String";
    }>;
    nodeFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, ObjectRef<Types, {}>, Types["DefaultNodeNullability"], {}, GlobalIDShape<Types> | string>, "args" | "nullable" | "resolve" | "type"> & {
        nullable?: Types["DefaultNodeNullability"];
    };
    edgesFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, [
        ObjectRef<Types, {}>
    ], Types["DefaultEdgesNullability"], {}, unknown[]>, "args" | "nullable" | "resolve" | "type"> & {
        nullable?: Types["DefaultEdgesNullability"];
    };
    nodesFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, [
        ObjectRef<Types, {}>
    ], FieldNullability<[
        unknown
    ]>, {}, unknown[]>, "args" | "resolve" | "type">;
    pageInfoFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, OutputRef<PageInfoShape>, boolean, {}, PageInfoShape>, "args" | "resolve" | "type">;
    hasNextPageFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, "Boolean", boolean, {}, boolean>, "args" | "resolve" | "type">;
    hasPreviousPageFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, "Boolean", boolean, {}, boolean>, "args" | "resolve" | "type">;
    startCursorFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, "ID" | "String", boolean, {}, string | null>, "args" | "resolve" | "type">;
    endCursorFieldOptions: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, PageInfoShape, "ID" | "String", boolean, {}, string | null>, "args" | "resolve" | "type">;
    beforeArgOptions: Omit<PothosSchemaTypes.InputObjectFieldOptions<Types, "ID" | "String", boolean>, "required" | "type">;
    afterArgOptions: Omit<PothosSchemaTypes.InputObjectFieldOptions<Types, "ID" | "String", boolean>, "required" | "type">;
    firstArgOptions: Omit<PothosSchemaTypes.InputObjectFieldOptions<Types, "Int", boolean>, "required" | "type">;
    lastArgOptions: Omit<PothosSchemaTypes.InputObjectFieldOptions<Types, "Int", boolean>, "required" | "type">;
    encodeGlobalID?: (typename: string, id: bigint | number | string, ctx: Types["Context"]) => string;
    decodeGlobalID?: (globalID: string, ctx: Types["Context"]) => {
        typename: string;
        id: string;
    };
    defaultConnectionTypeOptions: Partial<PothosSchemaTypes.ObjectTypeOptions<Types, ConnectionShape<Types, unknown, false, true, true>>>;
    defaultEdgeTypeOptions: Partial<PothosSchemaTypes.ObjectTypeOptions<Types, {
        cursor: string;
        node: unknown;
    }>>;
    defaultPayloadTypeOptions: Partial<PothosSchemaTypes.ObjectTypeOptions<Types, {}>>;
    defaultMutationInputTypeOptions: Partial<Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, {}>, "fields">>;
    defaultConnectionFieldOptions?: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, OutputRef<ConnectionShape<Types, unknown, false, true, true>>, boolean, InputFieldsFromShape<Types, DefaultConnectionArguments, "Arg">, ConnectionShape<Types, unknown, false, true, true>>, "args" | "resolve" | "type">;
    nodesOnConnection?: Omit<PothosSchemaTypes.ObjectFieldOptions<Types, {}, [
        ObjectRef<Types, {}>
    ], {
        list: false;
        items: Types["DefaultNodeNullability"];
    }, {}, GlobalIDShape<Types> | string>, "args" | "nullable" | "resolve" | "type"> | boolean;
}>;
export interface DefaultEdgesNullability {
    list: true;
    items: true;
}
export interface PageInfoShape {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
}
export interface GlobalIDShape<Types extends SchemaTypes> {
    id: OutputShape<Types, "ID">;
    type: OutputType<Types> | string;
}
export type ConnectionEdgesShape<Types extends SchemaTypes, T, NodeNullable extends boolean, EdgesNullable extends FieldNullability<[
    unknown
]>> = ShapeFromListTypeParam<Types, [
    ObjectRef<Types, {
        cursor: string;
        node: NodeNullable extends false ? T : T | null | undefined;
    }>
], EdgesNullable>;
export interface ConnectionResultShape<Types extends SchemaTypes, T, EdgesNullable extends FieldNullability<[
    unknown
]> = Types["DefaultEdgesNullability"], NodeNullable extends boolean = Types["DefaultNodeNullability"]> {
    pageInfo: MaybePromise<PageInfoShape>;
    edges: MaybePromise<ConnectionEdgesShape<Types, T, NodeNullable, EdgesNullable>>;
}
export type ConnectionShape<Types extends SchemaTypes, T, Nullable, EdgesNullable extends FieldNullability<[
    unknown
]> = Types["DefaultEdgesNullability"], NodeNullable extends boolean = Types["DefaultNodeNullability"], ConnectionResult extends ConnectionResultShape<Types, T, EdgesNullable, NodeNullable> = ConnectionResultShape<Types, T, EdgesNullable, NodeNullable>> = (Nullable extends false ? never : null | undefined) | (ConnectionResult & Types["Connection"]);
export type ConnectionShapeFromBaseShape<Types extends SchemaTypes, Shape, Nullable extends boolean> = ConnectionShape<Types, Shape, Nullable>;
export type ConnectionShapeForType<Types extends SchemaTypes, Type extends OutputType<Types>, Nullable extends boolean, EdgeNullability extends FieldNullability<[
    unknown
]>, NodeNullability extends boolean, ConnectionResult extends ConnectionResultShape<Types, ShapeFromTypeParam<Types, Type, false>, EdgeNullability, NodeNullability> = ConnectionResultShape<Types, ShapeFromTypeParam<Types, Type, false>, EdgeNullability, NodeNullability>> = ConnectionShape<Types, ShapeFromTypeParam<Types, Type, false>, Nullable, EdgeNullability, NodeNullability, ConnectionResult>;
export type ConnectionShapeFromResolve<Types extends SchemaTypes, Type extends OutputType<Types>, Nullable extends boolean, EdgeNullability extends FieldNullability<[
    unknown
]>, NodeNullability extends boolean, Resolved, ConnectionResult extends ConnectionResultShape<Types, ShapeFromTypeParam<Types, Type, false>, EdgeNullability, NodeNullability> = ConnectionResultShape<Types, ShapeFromTypeParam<Types, Type, false>, EdgeNullability, NodeNullability>> = Resolved extends Promise<infer T> ? NonNullable<T> extends ConnectionShapeForType<Types, Type, Nullable, EdgeNullability, NodeNullability> ? NonNullable<T> : ConnectionShapeForType<Types, Type, Nullable, EdgeNullability, NodeNullability, ConnectionResult> & NonNullable<T> : Resolved extends ConnectionShapeForType<Types, Type, Nullable, EdgeNullability, NodeNullability, ConnectionResult> ? NonNullable<Resolved> : ConnectionShapeForType<Types, Type, Nullable, EdgeNullability, NodeNullability, ConnectionResult> & NonNullable<Resolved>;
export interface DefaultConnectionArguments extends PothosSchemaTypes.DefaultConnectionArguments {
}
export type NodeBaseObjectOptionsForParam<Types extends SchemaTypes, Param extends ObjectParam<Types>, Interfaces extends InterfaceParam<Types>[]> = ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>;
export type NodeObjectOptions<Types extends SchemaTypes, Param extends ObjectParam<Types>, Interfaces extends InterfaceParam<Types>[], IDShape = string> = NodeBaseObjectOptionsForParam<Types, Param, Interfaces> & {
    id: Omit<FieldOptionsFromKind<Types, ParentShape<Types, Param>, "ID", false, {}, "Object", OutputShape<Types, "ID">, MaybePromise<OutputShape<Types, "ID">>>, "args" | "nullable" | "type"> & {
        parse?: (id: string, ctx: Types["Context"]) => IDShape;
    };
    brandLoadedObjects?: boolean;
    loadOne?: (id: IDShape, context: Types["Context"]) => MaybePromise<OutputShape<Types, Param> | null | undefined>;
    loadMany?: (ids: IDShape[], context: Types["Context"]) => MaybePromise<readonly MaybePromise<OutputShape<Types, Param> | null | undefined>[]>;
    loadWithoutCache?: (id: IDShape, context: Types["Context"], info: GraphQLResolveInfo) => MaybePromise<OutputShape<Types, Param> | null | undefined>;
    loadManyWithoutCache?: (ids: IDShape[], context: Types["Context"]) => MaybePromise<readonly MaybePromise<OutputShape<Types, Param> | null | undefined>[]>;
};
export type GlobalIDFieldOptions<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap, Nullable extends boolean, ResolveReturnShape, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, "ID", Nullable, Args, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type"> & {
    resolve: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>, ResolveReturnShape>;
};
export type GlobalIDInputFieldOptions<Types extends SchemaTypes, Req extends boolean, Kind extends "Arg" | "InputObject", For = unknown> = Omit<PothosSchemaTypes.InputFieldOptionsByKind<Types, "ID", Req>[Kind], "type"> & {
    for?: For | For[];
};
export type GlobalIDListInputFieldOptions<Types extends SchemaTypes, Req extends FieldRequiredness<[
    "ID"
]>, Kind extends "Arg" | "InputObject", For = unknown> = Omit<PothosSchemaTypes.InputFieldOptionsByKind<Types, [
    "ID"
], Req>[Kind], "type"> & {
    for?: For | For[];
};
export type NodeIDFieldOptions<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap, Nullable extends boolean, ResolveReturnShape, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, "ID", Nullable, Args, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type"> & {
    resolve: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>, ResolveReturnShape>;
};
export type GlobalIDListFieldOptions<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap, Nullable extends FieldNullability<[
    unknown
]>, ResolveReturnShape, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, [
    "ID"
], Nullable, Args, Kind, ParentShape, ResolveReturnShape>, "resolve" | "type"> & {
    resolve: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], ShapeFromTypeParam<Types, [
        OutputRefShape<GlobalIDShape<Types> | string>
    ], {
        list: false;
        items: true;
    }>, ResolveReturnShape>;
};
export type NodeFieldOptions<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap, ResolveReturnShape, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, OutputRefShape<GlobalIDShape<Types> | string>, true, Args, Kind, ParentShape, ResolveReturnShape>, "nullable" | "resolve" | "type"> & {
    id: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], ShapeFromTypeParam<Types, OutputRefShape<GlobalIDShape<Types> | string>, true>, ResolveReturnShape>;
};
export type NodeListFieldOptions<Types extends SchemaTypes, ParentShape, Args extends InputFieldMap, ResolveReturnShape, Kind extends FieldKind = FieldKind> = Omit<FieldOptionsFromKind<Types, ParentShape, [
    OutputRefShape<GlobalIDShape<Types> | string>
], {
    list: false;
    items: true;
}, Args, Kind, ParentShape, ResolveReturnShape>, "nullable" | "resolve" | "type"> & {
    ids: Resolver<ParentShape, InputShapeFromFields<Args>, Types["Context"], ShapeFromTypeParam<Types, [
        OutputRefShape<GlobalIDShape<Types> | string>
    ], {
        list: false;
        items: true;
    }>, ResolveReturnShape>;
};
export interface GlobalIDInputShape<T = string> {
    [inputShapeKey]: {
        typename: string;
        id: T;
    };
}
export type RelayMutationInputOptions<Types extends SchemaTypes, Fields extends InputFieldMap, InputName extends string> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, "fields"> & {
    name?: string;
    argName?: InputName;
    inputFields: (t: PothosSchemaTypes.InputFieldBuilder<Types, "InputObject">) => Fields;
};
export type RelayMutationFieldOptions<Types extends SchemaTypes, Fields extends InputFieldMap, Nullable extends boolean, InputName extends string, ResolveShape, ResolveReturnShape, Args extends InputFieldMap = {}> = Omit<FieldOptionsFromKind<Types, Types["Root"], OutputRef<ResolveShape>, Nullable, Args & {
    [K in InputName]: ArgumentRef<Types, InputShapeWithClientMutationId<Types, Fields>>;
}, "Mutation", ResolveShape, ResolveReturnShape>, "args" | "type"> & {
    args?: Args;
};
export type RelayMutationPayloadOptions<Types extends SchemaTypes, Shape, Interfaces extends InterfaceParam<Types>[]> = Omit<PothosSchemaTypes.ObjectTypeOptions<Types, Shape> | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>, "fields"> & {
    name?: string;
    outputFields: ObjectFieldsShape<Types, Shape>;
};
export type InputShapeWithClientMutationId<Types extends SchemaTypes, Fields extends InputFieldMap> = InputShapeFromFields<Fields & {
    clientMutationId: InputFieldRef<Types, Types["Scalars"]["ID"]["Input"]>;
}>;
