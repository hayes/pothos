// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { assertArray, FieldKind, FieldNullability, InputFieldMap, InputShapeFromFields, InterfaceRef, ObjectFieldsShape, RootFieldBuilder, SchemaTypes, } from '../core/index.ts';
import { connectionRefs, globalConnectionFieldsMap } from './schema-builder.ts';
import { ConnectionShape, GlobalIDFieldOptions, GlobalIDListFieldOptions, GlobalIDShape, } from './types.ts';
import { capitalize, resolveNodes } from './utils/index.ts';
import { internalEncodeGlobalID } from './utils/internal.ts';
const fieldBuilderProto = RootFieldBuilder.prototype as GiraphQLSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
fieldBuilderProto.globalIDList = function globalIDList<Args extends InputFieldMap, Nullable extends FieldNullability<[
    "ID"
]>, ResolveReturnShape>({ resolve, ...options }: GlobalIDListFieldOptions<SchemaTypes, unknown, Args, Nullable, ResolveReturnShape, FieldKind>) {
    const wrappedResolve = async (parent: unknown, args: InputShapeFromFields<Args>, context: object, info: GraphQLResolveInfo) => {
        const result = await resolve(parent, args, context, info);
        if (!result) {
            return result;
        }
        assertArray(result);
        if (Array.isArray(result)) {
            return (await Promise.all(result)).map((item: GlobalIDShape<SchemaTypes> | null | undefined) => item == null || typeof item === "string"
                ? item
                : internalEncodeGlobalID(this.builder, this.builder.configStore.getTypeConfig(item.type).name, String(item.id)));
        }
        return null;
    };
    return this.field({
        ...options,
        type: ["ID"],
        resolve: wrappedResolve as never, // resolve is not expected because we don't know FieldKind
    });
};
fieldBuilderProto.globalID = function globalID<Args extends InputFieldMap, Nullable extends FieldNullability<"ID">, ResolveReturnShape>({ resolve, ...options }: GlobalIDFieldOptions<SchemaTypes, unknown, Args, Nullable, ResolveReturnShape, FieldKind>) {
    const wrappedResolve = async (parent: unknown, args: InputShapeFromFields<Args>, context: object, info: GraphQLResolveInfo) => {
        const result = await resolve(parent, args, context, info);
        if (!result || typeof result === "string") {
            return result;
        }
        const item = (result as unknown) as GlobalIDShape<SchemaTypes>;
        return internalEncodeGlobalID(this.builder, this.builder.configStore.getTypeConfig(item.type).name, String(item.id));
    };
    return this.field({
        ...options,
        type: "ID",
        resolve: wrappedResolve as never, // resolve is not expected because we don't know FieldKind
    });
};
fieldBuilderProto.node = function node({ id, ...options }) {
    return this.field<{}, InterfaceRef<unknown>, unknown, Promise<unknown>, true>({
        ...options,
        type: this.builder.nodeInterfaceRef(),
        nullable: true,
        resolve: async (parent: unknown, args: {}, context: object, info: GraphQLResolveInfo) => {
            const rawID = ((await id(parent, args as never, context, info)) as unknown) as GlobalIDShape<SchemaTypes> | string | null | undefined;
            if (rawID == null) {
                return null;
            }
            const globalID = typeof rawID === "string"
                ? rawID
                : internalEncodeGlobalID(this.builder, this.builder.configStore.getTypeConfig(rawID.type).name, String(rawID.id));
            return (await resolveNodes(this.builder, context, [globalID]))[0];
        },
    });
};
fieldBuilderProto.nodeList = function nodeList({ ids, ...options }) {
    return this.field({
        ...options,
        nullable: {
            list: false,
            items: true,
        },
        type: [this.builder.nodeInterfaceRef()],
        resolve: async (parent: unknown, args: {}, context: object, info: GraphQLResolveInfo) => {
            const rawIDList = await ids(parent, args as never, context, info);
            assertArray(rawIDList);
            if (!Array.isArray(rawIDList)) {
                return [];
            }
            const rawIds = (await Promise.all(rawIDList)) as (GlobalIDShape<SchemaTypes> | string | null | undefined)[];
            const globalIds = rawIds.map((id) => !id || typeof id === "string"
                ? id
                : internalEncodeGlobalID(this.builder, this.builder.configStore.getTypeConfig(id.type).name, String(id.id)));
            return resolveNodes(this.builder, context, globalIds);
        },
    });
};
fieldBuilderProto.connection = function connection({ type, ...fieldOptions }, { name: connectionNameFromOptions, ...connectionOptions } = {} as never, { name: edgeNameFromOptions, ...edgeOptions } = {} as never) {
    const placeholderRef = this.builder.objectRef<ConnectionShape<SchemaTypes, unknown, boolean>>("Unnamed connection");
    const fieldRef = this.field({
        ...fieldOptions,
        type: placeholderRef,
        args: {
            ...fieldOptions.args,
            before: this.arg.id({ required: false }),
            after: this.arg.id({ required: false }),
            first: this.arg.int({ required: false }),
            last: this.arg.int({ required: false }),
        },
        resolve: fieldOptions.resolve as never,
    });
    this.builder.configStore.onFieldUse(fieldRef, (fieldConfig) => {
        const connectionName = connectionNameFromOptions ??
            `${this.typename}${capitalize(fieldConfig.name)}${fieldConfig.name.toLowerCase().endsWith("connection") ? "" : "Connection"}`;
        const connectionRef = this.builder.objectRef<ConnectionShape<SchemaTypes, unknown, false>>(connectionName);
        const edgeName = edgeNameFromOptions ?? `${connectionName}Edge`;
        const edgeRef = this.builder.objectRef<{
            cursor: string;
            node: unknown;
        }>(edgeName);
        const connectionFields = (connectionOptions.fields as unknown) as ObjectFieldsShape<SchemaTypes, ConnectionShape<SchemaTypes, unknown, false>> | undefined;
        const edgeFields = edgeOptions.fields as ObjectFieldsShape<SchemaTypes, {
            cursor: string;
            node: unknown;
        }> | undefined;
        this.builder.objectType(connectionRef, {
            ...connectionOptions,
            fields: (t) => ({
                pageInfo: t.field({
                    type: this.builder.pageInfoRef(),
                    resolve: (parent) => parent.pageInfo,
                }),
                edges: t.field({
                    type: [edgeRef],
                    nullable: {
                        list: false,
                        items: true,
                    },
                    resolve: (parent) => parent.edges,
                }),
                ...connectionFields?.(t),
            }),
        });
        this.builder.configStore.associateRefWithName(placeholderRef, connectionName);
        this.builder.objectType(edgeRef, {
            ...edgeOptions,
            fields: (t) => ({
                node: t.field({
                    type,
                    resolve: (parent) => parent.node as never,
                }),
                cursor: t.exposeString("cursor", {}),
                ...edgeFields?.(t),
            }),
        });
        if (!connectionRefs.has(this.builder)) {
            connectionRefs.set(this.builder, []);
        }
        connectionRefs.get(this.builder)!.push(placeholderRef);
        globalConnectionFieldsMap.get(this.builder)?.forEach((fieldFn) => void fieldFn(placeholderRef));
    });
    return fieldRef as never;
};
