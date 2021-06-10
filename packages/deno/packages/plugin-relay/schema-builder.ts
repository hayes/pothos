// @ts-nocheck
import SchemaBuilder, { createContextCache, FieldRef, InterfaceParam, InterfaceRef, ObjectFieldsShape, ObjectFieldThunk, ObjectParam, ObjectRef, OutputRef, SchemaTypes, } from '../core/index.ts';
import { ConnectionShape, GlobalIDShape, PageInfoShape } from './types.ts';
import { capitalize, resolveNodes } from './utils/index.ts';
const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;
const pageInfoRefMap = new WeakMap<GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>, ObjectRef<PageInfoShape>>();
const nodeInterfaceRefMap = new WeakMap<GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>, InterfaceRef<ObjectParam<SchemaTypes>>>();
export const connectionRefs = new WeakMap<GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>, ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>[]>();
export const globalConnectionFieldsMap = new WeakMap<GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>, ((ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => void)[]>();
schemaBuilderProto.pageInfoRef = function pageInfoRef() {
    if (pageInfoRefMap.has(this)) {
        return pageInfoRefMap.get(this)!;
    }
    const ref = this.objectRef<PageInfoShape>("PageInfo");
    pageInfoRefMap.set(this, ref);
    ref.implement({
        ...this.options.relayOptions.pageInfoTypeOptions,
        fields: (t) => ({
            hasNextPage: t.exposeBoolean("hasNextPage", {}),
            hasPreviousPage: t.exposeBoolean("hasPreviousPage", {}),
            startCursor: t.exposeString("startCursor", { nullable: true }),
            endCursor: t.exposeString("endCursor", { nullable: true }),
        }),
    });
    return ref;
};
schemaBuilderProto.nodeInterfaceRef = function nodeInterfaceRef() {
    if (nodeInterfaceRefMap.has(this)) {
        return nodeInterfaceRefMap.get(this)!;
    }
    const ref = this.interfaceRef<ObjectParam<SchemaTypes>>("Node");
    nodeInterfaceRefMap.set(this, ref);
    ref.implement({
        ...this.options.relayOptions.nodeTypeOptions,
        fields: (t) => ({
            id: t.globalID({
                resolve: (parent) => {
                    throw new Error("id field not implemented");
                },
            }),
        }),
    });
    this.queryField("node", (t) => t.field({
        ...this.options.relayOptions.nodeQueryOptions,
        type: ref as InterfaceRef<unknown>,
        args: {
            id: t.arg.id({ required: true }),
        },
        nullable: true,
        resolve: async (root, args, context) => (await resolveNodes(this, context, [String(args.id)]))[0],
    }) as FieldRef<unknown>);
    this.queryField("nodes", (t) => t.field({
        ...this.options.relayOptions.nodesQueryOptions,
        type: [ref],
        args: {
            ids: t.arg.idList({ required: true }),
        },
        nullable: {
            list: false,
            items: true,
        },
        resolve: async (root, args, context) => (await resolveNodes(this, context, args.ids as string[])) as Promise<ObjectParam<SchemaTypes> | null>[],
    }));
    return ref;
};
schemaBuilderProto.node = function node(param, { interfaces, ...options }, fields) {
    const interfacesWithNode: InterfaceParam<SchemaTypes>[] = [
        this.nodeInterfaceRef(),
        ...((interfaces ?? []) as InterfaceParam<SchemaTypes>[]),
    ];
    let nodeName!: string;
    const ref = this.objectType<[
    ], ObjectParam<SchemaTypes>>(param as ObjectParam<SchemaTypes>, {
        ...options,
        isTypeOf: (maybeNode, context, info) => {
            if (options.isTypeOf) {
                return options.isTypeOf(maybeNode, context, info);
            }
            if (!maybeNode) {
                return false;
            }
            if (typeof param === "function" && (maybeNode as unknown) instanceof (param as Function)) {
                return true;
            }
            const proto = Object.getPrototypeOf(maybeNode) as {
                constructor: unknown;
            };
            try {
                if (proto?.constructor) {
                    const config = this.configStore.getTypeConfig(proto.constructor as OutputRef);
                    return config.name === nodeName;
                }
                if (typeof maybeNode === "object") {
                    // eslint-disable-next-line no-underscore-dangle
                    const nodeRef = (maybeNode as {
                        __type: OutputRef;
                    }).__type;
                    if (!nodeRef) {
                        return false;
                    }
                    const config = this.configStore.getTypeConfig(nodeRef);
                    return config.name === nodeName;
                }
            }
            catch {
                // ignore
            }
            return false;
        },
        interfaces: interfacesWithNode as [
        ],
    }, fields);
    this.configStore.onTypeConfig(ref, (nodeConfig) => {
        nodeName = nodeConfig.name;
        this.objectField(ref, "id", (t) => t.globalID<{}, false, Promise<GlobalIDShape<SchemaTypes>>>({
            ...options.id,
            nullable: false,
            args: {},
            resolve: async (parent, args, context, info) => ({
                type: nodeConfig.name,
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                id: await options.id.resolve(parent, args, context, info),
            }),
        }));
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return ref;
};
schemaBuilderProto.globalConnectionField = function globalConnectionField(name, field) {
    const onRef = (ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => {
        this.objectField(ref, name, field as ObjectFieldThunk<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>);
    };
    connectionRefs.get(this)?.forEach((ref) => void onRef(ref));
    if (!globalConnectionFieldsMap.has(this)) {
        globalConnectionFieldsMap.set(this, []);
    }
    globalConnectionFieldsMap.get(this)!.push(onRef);
};
schemaBuilderProto.globalConnectionFields = function globalConnectionFields(fields) {
    const onRef = (ref: ObjectRef<ConnectionShape<SchemaTypes, unknown, boolean>>) => {
        this.objectFields(ref, fields as ObjectFieldsShape<SchemaTypes, ConnectionShape<SchemaTypes, unknown, boolean>>);
    };
    connectionRefs.get(this)?.forEach((ref) => void onRef(ref));
    if (!globalConnectionFieldsMap.has(this)) {
        globalConnectionFieldsMap.set(this, []);
    }
    globalConnectionFieldsMap.get(this)!.push(onRef);
};
const mutationIdCache = createContextCache(() => new Map<string, string>());
schemaBuilderProto.relayMutationField = function relayMutationField(fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, { resolve, ...fieldOptions }, { name: payloadName = `${capitalize(fieldName)}Payload`, outputFields, interfaces, ...paylaodOptions }) {
    const { relayOptions: { clientMutationIdInputOptions, clientMutationIdFieldOptions, mutationInputArgOptions, }, } = this.options;
    if (!mutationInputArgOptions) {
        throw new Error("relayOptions.mutationInputArgOptions must be set in builder options to use `relayMutationField`");
    }
    if (!clientMutationIdInputOptions) {
        throw new Error("relayOptions.clientMutationIdInputOptions must be set in builder options to use `relayMutationField`");
    }
    if (!clientMutationIdFieldOptions) {
        throw new Error("relayOptions.clientMutationIdFieldOptions must be set in builder options to use `relayMutationField`");
    }
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: (t) => ({
            ...inputFields(t),
            clientMutationId: t.id({ ...clientMutationIdInputOptions, required: true }),
        }),
    });
    const payloadRef = this.objectRef<unknown>(payloadName).implement({
        ...paylaodOptions,
        interfaces: interfaces as never,
        fields: (t) => ({
            ...(outputFields as ObjectFieldsShape<SchemaTypes, unknown>)(t),
            clientMutationId: t.id({
                ...clientMutationIdFieldOptions,
                nullable: false,
                resolve: (parent, args, context, info) => mutationIdCache(context).get(String(info.path.prev!.key))!,
            }),
        }),
    });
    this.mutationField(fieldName, (t) => t.field({
        ...(fieldOptions as {}),
        type: payloadRef,
        args: {
            [argName]: t.arg({ ...(mutationInputArgOptions as {}), type: inputRef, required: true }),
        },
        resolve: (root, args, context, info) => {
            mutationIdCache(context).set(String(info.path.key), ((args as unknown) as Record<string, {
                clientMutationId: string;
            }>)[argName]
                .clientMutationId);
            return resolve(root, args as never, context, info);
        },
    }));
};
