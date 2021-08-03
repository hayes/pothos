// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { assertArray, FieldKind, FieldNullability, InputFieldMap, InputShapeFromFields, InterfaceRef, RootFieldBuilder, SchemaTypes, } from '../core/index.ts';
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
        const item = result as unknown as GlobalIDShape<SchemaTypes>;
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
            const rawID = (await id(parent, args as never, context, info)) as unknown as GlobalIDShape<SchemaTypes> | string | null | undefined;
            if (rawID == null) {
                return null;
            }
            const globalID = typeof rawID === "string"
                ? rawID
                : internalEncodeGlobalID(this.builder, this.builder.configStore.getTypeConfig(rawID.type).name, String(rawID.id));
            return (await resolveNodes(this.builder, context, info, [globalID]))[0];
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
            return resolveNodes(this.builder, context, info, globalIds);
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
            ...this.arg.connectionArgs(),
        } as unknown as {},
        resolve: fieldOptions.resolve as never,
    });
    this.builder.configStore.onFieldUse(fieldRef, (fieldConfig) => {
        const connectionName = connectionNameFromOptions ??
            `${this.typename}${capitalize(fieldConfig.name)}${fieldConfig.name.toLowerCase().endsWith("connection") ? "" : "Connection"}`;
        const edgeName = edgeNameFromOptions ?? `${connectionName}Edge`;
        this.builder.connectionObject({
            type,
            name: connectionName,
            ...connectionOptions,
        }, {
            name: edgeName,
            ...edgeOptions,
        });
        this.builder.configStore.associateRefWithName(placeholderRef, connectionName);
    });
    return fieldRef as never;
};
