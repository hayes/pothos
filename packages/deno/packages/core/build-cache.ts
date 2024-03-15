// @ts-nocheck
/* eslint-disable no-continue */
import { defaultFieldResolver, defaultTypeResolver, GraphQLBoolean, GraphQLEnumType, GraphQLFieldConfigArgumentMap, GraphQLFieldConfigMap, GraphQLFloat, GraphQLID, GraphQLInputFieldConfigMap, GraphQLInputObjectType, GraphQLInputType, GraphQLInt, GraphQLInterfaceType, GraphQLList, GraphQLNamedType, GraphQLNonNull, GraphQLObjectType, GraphQLOutputType, GraphQLScalarType, GraphQLString, GraphQLTypeResolver, GraphQLUnionType, } from 'https://cdn.skypack.dev/graphql?dts';
import type { SchemaBuilder } from './builder.ts';
import type { ConfigStore } from './config-store.ts';
import { PothosError, PothosSchemaError } from './errors.ts';
import { BasePlugin, MergedPlugins } from './plugins/index.ts';
import { BuiltinScalarRef } from './refs/builtin-scalar.ts';
import { InputType, OutputType, PothosEnumTypeConfig, PothosEnumValueConfig, PothosInputFieldConfig, PothosInputFieldType, PothosInputObjectTypeConfig, PothosInterfaceTypeConfig, PothosKindToGraphQLTypeClass, PothosMutationTypeConfig, PothosObjectTypeConfig, PothosOutputFieldConfig, PothosOutputFieldType, PothosQueryTypeConfig, PothosScalarTypeConfig, PothosSubscriptionTypeConfig, PothosTypeConfig, PothosTypeKind, PothosUnionTypeConfig, SchemaTypes, typeBrandKey, } from './types/index.ts';
import { assertNever, getTypeBrand, isThenable } from './utils/index.ts';
export class BuildCache<Types extends SchemaTypes> {
    types = new Map<string, GraphQLNamedType>();
    builder: PothosSchemaTypes.SchemaBuilder<Types>;
    plugin: BasePlugin<Types>;
    options: PothosSchemaTypes.BuildSchemaOptions<Types>;
    private configStore: ConfigStore<Types>;
    private pluginList: BasePlugin<Types>[];
    private implementers = new Map<string, PothosObjectTypeConfig[]>();
    private typeConfigs = new Map<string, PothosTypeConfig>();
    private enumValueConfigs = new Map<PothosEnumValueConfig<Types>, PothosEnumValueConfig<Types> | null>();
    private outputFieldConfigs = new Map<PothosOutputFieldConfig<Types>, PothosOutputFieldConfig<Types> | null>();
    private inputFieldConfigs = new Map<PothosInputFieldConfig<Types>, PothosInputFieldConfig<Types> | null>();
    constructor(builder: SchemaBuilder<Types>, options: PothosSchemaTypes.BuildSchemaOptions<Types>) {
        this.builder = builder;
        this.configStore = builder.configStore;
        this.options = options;
        const plugins: Record<string, unknown> = {};
        this.pluginList = (builder.options.plugins ?? []).map((pluginName) => {
            const Plugin = (this.builder as unknown as {
                constructor: {
                    plugins: Record<string, typeof BasePlugin>;
                };
            }).constructor.plugins[pluginName];
            if (!Plugin) {
                throw new PothosError(`No plugin named ${pluginName} was registered`);
            }
            plugins[pluginName] = new Plugin(this, pluginName);
            return plugins[pluginName] as BasePlugin<Types>;
        });
        this.plugin = new MergedPlugins(this, this.pluginList);
    }
    getTypeConfig<T extends PothosTypeConfig["kind"]>(ref: InputType<Types> | OutputType<Types> | string, kind?: T) {
        const baseConfig = this.configStore.getTypeConfig(ref, kind);
        if (!this.typeConfigs.has(baseConfig.name)) {
            this.typeConfigs.set(baseConfig.name, this.plugin.onTypeConfig(baseConfig));
        }
        const typeConfig = this.typeConfigs.get(baseConfig.name)!;
        return typeConfig as Extract<PothosTypeConfig, {
            kind: T;
        }>;
    }
    getInputTypeFieldConfigs(ref: InputType<Types>) {
        const typeConfig = this.getTypeConfig(ref, "InputObject");
        const builtType = this.types.get(typeConfig.name) as GraphQLInputObjectType | undefined;
        if (!builtType) {
            throw new PothosSchemaError(`Input type ${typeConfig.name} has not been built yet`);
        }
        const fields = builtType.getFields();
        const fieldConfigs: Record<string, PothosInputFieldConfig<Types>> = {};
        Object.keys(fields).forEach((fieldName) => {
            fieldConfigs[fieldName] = fields[fieldName].extensions
                ?.pothosConfig as PothosInputFieldConfig<Types>;
        });
        return fieldConfigs;
    }
    getImplementers(iface: GraphQLInterfaceType) {
        if (this.implementers.has(iface.name)) {
            return this.implementers.get(iface.name)!;
        }
        const implementers = [...this.configStore.typeConfigs.values()].filter((config) => config.kind === "Object" &&
            config.interfaces.find((i) => this.configStore.getTypeConfig(i).name === iface.name)) as PothosObjectTypeConfig[];
        this.implementers.set(iface.name, implementers);
        return implementers;
    }
    buildAll() {
        this.configStore.prepareForBuild();
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "Enum" || config.kind === "Scalar") {
                this.buildTypeFromConfig(config);
            }
        });
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "InputObject") {
                this.buildTypeFromConfig(config);
            }
        });
        this.types.forEach((type) => {
            if (type instanceof GraphQLInputObjectType) {
                type.getFields();
            }
        });
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "Interface") {
                this.buildTypeFromConfig(config);
            }
        });
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "Object") {
                this.buildTypeFromConfig(config);
            }
        });
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "Union") {
                this.buildTypeFromConfig(config);
            }
        });
        this.configStore.typeConfigs.forEach((config) => {
            if (config.kind === "Query" || config.kind === "Mutation" || config.kind === "Subscription") {
                this.buildTypeFromConfig(config);
            }
        });
        this.types.forEach((type) => {
            if (type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType) {
                type.getFields();
            }
            else if (type instanceof GraphQLUnionType) {
                type.getTypes();
            }
        });
    }
    buildTypeFromConfig(baseConfig: PothosTypeConfig) {
        const config = this.getTypeConfig(baseConfig.name);
        const { name } = config;
        this.typeConfigs.set(name, config);
        switch (config.kind) {
            case "Enum":
                this.addType(name, this.buildEnum(config));
                break;
            case "InputObject":
                this.addType(name, this.buildInputObject(config));
                break;
            case "Interface":
                this.addType(name, this.buildInterface(config));
                break;
            case "Scalar":
                this.addType(name, this.buildScalar(config));
                break;
            case "Union":
                this.addType(name, this.buildUnion(config));
                break;
            case "Object":
            case "Query":
            case "Mutation":
            case "Subscription":
                this.addType(name, this.buildObject(config));
                break;
            default:
                assertNever(config);
        }
    }
    private addType(ref: string, type: GraphQLNamedType) {
        if (this.types.has(ref)) {
            throw new PothosSchemaError(`reference or name has already been used to create another type (${type.name})`);
        }
        this.types.set(ref, type);
    }
    private buildOutputTypeParam(type: PothosOutputFieldType<Types>): GraphQLOutputType {
        if (type.kind === "List") {
            if (type.nullable) {
                return new GraphQLList(this.buildOutputTypeParam(type.type));
            }
            return new GraphQLNonNull(new GraphQLList(this.buildOutputTypeParam(type.type)));
        }
        if (type.nullable) {
            return this.getOutputType(type.ref);
        }
        return new GraphQLNonNull(this.getOutputType(type.ref));
    }
    private buildInputTypeParam(type: PothosInputFieldType<Types>): GraphQLInputType {
        if (type.kind === "List") {
            if (type.required) {
                return new GraphQLNonNull(new GraphQLList(this.buildInputTypeParam(type.type)));
            }
            return new GraphQLList(this.buildInputTypeParam(type.type));
        }
        if (type.required) {
            return new GraphQLNonNull(this.getInputType(type.ref));
        }
        return this.getInputType(type.ref);
    }
    private buildFields(fields: Map<string, PothosOutputFieldConfig<Types>>): GraphQLFieldConfigMap<unknown, object> {
        const built: GraphQLFieldConfigMap<unknown, object> = {};
        for (const [fieldName, originalConfig] of fields) {
            if (!this.outputFieldConfigs.has(originalConfig)) {
                this.outputFieldConfigs.set(originalConfig, this.plugin.onOutputFieldConfig(originalConfig));
            }
            const updatedConfig = this.outputFieldConfigs.get(originalConfig)!;
            if (!updatedConfig) {
                continue;
            }
            const config = {
                ...updatedConfig,
            };
            const argMap = new Map<string, PothosInputFieldConfig<Types>>();
            Object.keys(config.args).forEach((argName) => {
                argMap.set(argName, config.args[argName]);
            });
            const args = this.buildInputFields(argMap);
            const argConfigs: Record<string, PothosInputFieldConfig<Types>> = {};
            Object.keys(config.args).forEach((argName) => {
                argConfigs[argName] = this.inputFieldConfigs.get(config.args[argName])!;
            });
            config.args = argConfigs;
            const resolve = this.plugin.wrapResolve(config.resolve ?? defaultFieldResolver, config);
            const subscribe = this.plugin.wrapSubscribe(config.subscribe, config);
            built[fieldName] = {
                ...config,
                type: this.buildOutputTypeParam(config.type),
                args,
                extensions: {
                    ...config.extensions,
                    pothosResolveWrapped: resolve !== (config.resolve ?? defaultFieldResolver),
                    pothosSubscribeWrapped: subscribe !== config.subscribe,
                    pothosOptions: config.pothosOptions,
                    pothosConfig: config,
                },
                resolve: resolve === defaultFieldResolver ? undefined : resolve,
                subscribe,
            };
        }
        return built;
    }
    private buildInputFields(fields: Map<string, PothosInputFieldConfig<Types>>): GraphQLInputFieldConfigMap {
        const built: GraphQLFieldConfigArgumentMap | GraphQLInputFieldConfigMap = {};
        for (const [fieldName, originalConfig] of fields) {
            if (!this.inputFieldConfigs.has(originalConfig)) {
                this.inputFieldConfigs.set(originalConfig, this.plugin.onInputFieldConfig(originalConfig));
            }
            const config = this.inputFieldConfigs.get(originalConfig)!;
            if (config) {
                built[fieldName] = {
                    ...config,
                    type: this.buildInputTypeParam(config.type),
                    extensions: {
                        ...config.extensions,
                        pothosOptions: config.pothosOptions,
                        pothosConfig: config,
                    },
                };
            }
        }
        return built;
    }
    private getInterfaceFields(type: GraphQLInterfaceType): GraphQLFieldConfigMap<unknown, object> {
        const interfaceFields = type
            .getInterfaces()
            .reduce((all, iface) => ({ ...this.getFields(iface), ...all }), {});
        const configs = this.configStore.getFields(type.name, "Interface");
        const fields = this.buildFields(configs);
        return {
            ...interfaceFields,
            ...fields,
        };
    }
    private getObjectFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
        const interfaceFields = type
            .getInterfaces()
            .reduce((all, iface) => ({ ...this.getFields(iface), ...all }), {});
        const objectFields = this.buildFields(this.configStore.getFields(type.name, "Object"));
        return { ...interfaceFields, ...objectFields };
    }
    private getRootFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
        return this.buildFields(this.configStore.getFields(type.name, "Object"));
    }
    private getFields(type: GraphQLNamedType): GraphQLFieldConfigMap<unknown, object> {
        if (type instanceof GraphQLObjectType) {
            if (type.name === "Query" || type.name === "Mutation" || type.name === "Subscription") {
                return this.getRootFields(type);
            }
            return this.getObjectFields(type);
        }
        if (type instanceof GraphQLInterfaceType) {
            return this.getInterfaceFields(type);
        }
        throw new PothosSchemaError(`Type ${type.name} does not have fields to resolve`);
    }
    private getInputFields(type: GraphQLInputObjectType): GraphQLInputFieldConfigMap {
        return this.buildInputFields(this.configStore.getFields(type.name, "InputObject"));
    }
    private getType(ref: InputType<Types> | OutputType<Types> | string) {
        if (ref instanceof BuiltinScalarRef) {
            return ref.type;
        }
        const typeConfig = this.configStore.getTypeConfig(ref);
        const type = this.types.get(typeConfig.name);
        if (!type) {
            this.buildTypeFromConfig(typeConfig);
            return this.types.get(typeConfig.name)!;
        }
        return type;
    }
    private getOutputType(ref: OutputType<Types> | string): GraphQLOutputType {
        const type = this.getType(ref);
        if (type instanceof GraphQLInputObjectType) {
            throw new PothosSchemaError(`Expected ${String(ref)} to be an output type but it was defined as an InputObject`);
        }
        return type;
    }
    private getInputType(ref: InputType<Types> | string): GraphQLInputType {
        const type = this.getType(ref);
        if (!type) {
            throw new PothosSchemaError(`Missing implementation of for type ${String(ref)}`);
        }
        if (type instanceof GraphQLObjectType) {
            throw new PothosSchemaError(`Expected ${type.name} to be an input type but it was defined as a GraphQLObjectType`);
        }
        if (type instanceof GraphQLInterfaceType) {
            throw new PothosSchemaError(`Expected ${type.name} to be an input type but it was defined as a GraphQLInterfaceType`);
        }
        if (type instanceof GraphQLUnionType) {
            throw new PothosSchemaError(`Expected ${String(ref)} to be an input type but it was defined as an GraphQLUnionType`);
        }
        return type;
    }
    private getTypeOfKind<T extends PothosTypeKind>(ref: InputType<Types> | OutputType<Types> | string, kind: T): PothosKindToGraphQLTypeClass<T> {
        const type = this.getType(ref);
        switch (kind) {
            case "Object":
            case "Query":
            case "Mutation":
            case "Subscription":
                if (type instanceof GraphQLObjectType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            case "Interface":
                if (type instanceof GraphQLInterfaceType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            case "Union":
                if (type instanceof GraphQLUnionType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            case "Enum":
                if (type instanceof GraphQLEnumType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            case "Scalar":
                if (type instanceof GraphQLScalarType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            case "InputObject":
                if (type instanceof GraphQLScalarType) {
                    return type as PothosKindToGraphQLTypeClass<T>;
                }
                break;
            default:
                break;
        }
        throw new PothosSchemaError(`Expected ${String(ref)} to be of type ${kind}`);
    }
    private buildObject(config: PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig) {
        const type: GraphQLObjectType = new GraphQLObjectType({
            ...config,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
            fields: () => this.getFields(type),
            isTypeOf: config.kind === "Object"
                ? this.plugin.wrapIsTypeOf(config.isTypeOf ?? undefined, config)
                : undefined,
            interfaces: config.kind === "Object"
                ? () => config.interfaces.map((iface) => this.getTypeOfKind(iface, "Interface"))
                : undefined,
        });
        return type;
    }
    private buildInterface(config: PothosInterfaceTypeConfig) {
        const resolveType: GraphQLTypeResolver<unknown, Types["Context"]> = (parent, context, info) => {
            const typeBrand = getTypeBrand(parent);
            if (typeBrand) {
                if (typeof typeBrand === "string") {
                    return typeBrand;
                }
                return this.getTypeConfig(typeBrand).name;
            }
            const resolver = config.resolveType ?? defaultTypeResolver;
            return resolver(parent, context, info, type);
        };
        const type: GraphQLInterfaceType = new GraphQLInterfaceType({
            ...config,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
            interfaces: () => config.interfaces.map((iface) => this.getTypeOfKind(iface, "Interface")),
            fields: () => this.getFields(type),
            resolveType: this.plugin.wrapResolveType(resolveType, config),
        });
        return type;
    }
    private buildUnion(config: PothosUnionTypeConfig) {
        const resolveType: GraphQLTypeResolver<unknown, Types["Context"]> = (parent, context, info, type) => {
            if (typeof parent === "object" && parent !== null && typeBrandKey in parent) {
                const typeBrand = (parent as {
                    [typeBrandKey]: OutputType<SchemaTypes>;
                })[typeBrandKey];
                if (typeof typeBrand === "string") {
                    return typeBrand;
                }
                return this.getTypeConfig(typeBrand).name;
            }
            if (!config.resolveType) {
                return defaultTypeResolver(parent, context, info, type);
            }
            const resultOrPromise = config.resolveType(parent, context, info, type);
            const getResult = (result: GraphQLObjectType<unknown, object> | string | null | undefined) => {
                if (typeof result === "string" || !result) {
                    return result!;
                }
                if (result instanceof GraphQLObjectType) {
                    return result.name;
                }
                try {
                    const typeConfig = this.configStore.getTypeConfig(result);
                    return typeConfig.name;
                }
                catch {
                    // ignore
                }
                return result;
            };
            return isThenable(resultOrPromise)
                ? resultOrPromise.then(getResult)
                : getResult(resultOrPromise);
        };
        return new GraphQLUnionType({
            ...config,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
            types: () => config.types.map((member) => this.getTypeOfKind(member, "Object")),
            resolveType: this.plugin.wrapResolveType(resolveType, config),
        });
    }
    private buildInputObject(config: PothosInputObjectTypeConfig) {
        const type: GraphQLInputType = new GraphQLInputObjectType({
            ...config,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
            fields: () => this.getInputFields(type as GraphQLInputObjectType),
        });
        return type;
    }
    private buildScalar(config: PothosScalarTypeConfig) {
        if (config.name === "ID") {
            return GraphQLID;
        }
        if (config.name === "Int") {
            return GraphQLInt;
        }
        if (config.name === "Float") {
            return GraphQLFloat;
        }
        if (config.name === "Boolean") {
            return GraphQLBoolean;
        }
        if (config.name === "String") {
            return GraphQLString;
        }
        return new GraphQLScalarType({
            ...config,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
        });
    }
    private buildEnum(config: PothosEnumTypeConfig) {
        const values: Record<string, PothosEnumValueConfig<Types>> = {};
        for (const key of Object.keys(config.values)) {
            const original = config.values[key] as PothosEnumValueConfig<Types>;
            if (!this.enumValueConfigs.has(original)) {
                this.enumValueConfigs.set(original, this.plugin.onEnumValueConfig(original));
            }
            const valueConfig = this.enumValueConfigs.get(original)!;
            if (valueConfig) {
                values[key] = this.enumValueConfigs.get(original)!;
            }
        }
        return new GraphQLEnumType({
            ...config,
            values,
            extensions: {
                ...config.extensions,
                pothosOptions: config.pothosOptions,
                pothosConfig: config,
            },
        });
    }
}
