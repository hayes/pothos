// @ts-nocheck
import { GraphQLBoolean, type GraphQLDirective, GraphQLFloat, GraphQLID, GraphQLInt, type GraphQLObjectType, type GraphQLScalarSerializer, type GraphQLScalarType, GraphQLSchema, GraphQLString, type GraphQLTypeResolver, lexicographicSortSchema, } from 'https://cdn.skypack.dev/graphql?dts';
import { BuildCache } from './build-cache.ts';
import { ConfigStore } from './config-store.ts';
import { PothosError, PothosSchemaError } from './errors.ts';
import { InputFieldBuilder } from './fieldUtils/input.ts';
import { InterfaceFieldBuilder } from './fieldUtils/interface.ts';
import { MutationFieldBuilder } from './fieldUtils/mutation.ts';
import { ObjectFieldBuilder } from './fieldUtils/object.ts';
import { QueryFieldBuilder } from './fieldUtils/query.ts';
import { SubscriptionFieldBuilder } from './fieldUtils/subscription.ts';
import { BaseTypeRef } from './refs/base.ts';
import { EnumRef } from './refs/enum.ts';
import { ImplementableInputObjectRef, InputObjectRef } from './refs/input-object.ts';
import { ImplementableInterfaceRef, InterfaceRef } from './refs/interface.ts';
import { MutationRef } from './refs/mutation.ts';
import { ImplementableObjectRef, ObjectRef } from './refs/object.ts';
import { QueryRef } from './refs/query.ts';
import { ScalarRef } from './refs/scalar.ts';
import { SubscriptionRef } from './refs/subscription.ts';
import { UnionRef } from './refs/union.ts';
import type { AbstractReturnShape, AddVersionedDefaultsToBuilderOptions, BaseEnum, ConfigurableRef, EnumParam, EnumTypeOptions, EnumValues, InputFieldMap, InputFieldsFromShape, InputShape, InputShapeFromFields, InterfaceFieldThunk, InterfaceFieldsShape, InterfaceParam, InterfaceTypeOptions, MutationFieldThunk, MutationFieldsShape, NormalizeArgs, NormalizeSchemeBuilderOptions, ObjectFieldThunk, ObjectFieldsShape, ObjectParam, ObjectTypeOptions, OneOfInputShapeFromFields, OutputShape, ParentShape, PluginConstructorMap, PothosInputObjectTypeConfig, QueryFieldThunk, QueryFieldsShape, RecursivelyNormalizeNullableFields, ScalarName, SchemaTypes, ShapeFromEnumValues, SubscriptionFieldThunk, SubscriptionFieldsShape, ValuesFromEnum, } from './types/index.ts';
import { normalizeEnumValues, valuesFromEnum, verifyInterfaces, verifyRef } from './utils/index.ts';
export class SchemaBuilder<Types extends SchemaTypes> {
    $inferSchemaTypes!: Types;
    static plugins: Partial<PluginConstructorMap<SchemaTypes>> = {};
    static optionNormalizers: Map<string, {
        v3?: (options: AddVersionedDefaultsToBuilderOptions<SchemaTypes, "v3">) => Partial<NormalizeSchemeBuilderOptions<SchemaTypes>>;
        v4?: undefined;
    }> = new Map();
    static allowPluginReRegistration = false;
    configStore: ConfigStore<Types>;
    options: PothosSchemaTypes.SchemaBuilderOptions<Types>;
    defaultFieldNullability: boolean;
    defaultInputFieldRequiredness: boolean;
    constructor(options: PothosSchemaTypes.SchemaBuilderOptions<Types>) {
        this.options = [...SchemaBuilder.optionNormalizers.values()].reduce((opts, normalize) => {
            if (options.defaults && typeof normalize[options.defaults] === "function") {
                return Object.assign(opts, normalize[options.defaults]!(opts));
            }
            return opts;
        }, options);
        this.configStore = new ConfigStore<Types>(this);
        this.defaultFieldNullability =
            (options as {
                defaultFieldNullability?: boolean;
            }).defaultFieldNullability ?? options.defaults !== "v3";
        this.defaultInputFieldRequiredness =
            (options as {
                defaultInputFieldRequiredness?: boolean;
            }).defaultInputFieldRequiredness ?? false;
    }
    static registerPlugin<T extends keyof PluginConstructorMap<SchemaTypes>>(name: T, plugin: PluginConstructorMap<SchemaTypes>[T], normalizeOptions?: {
        v3?: (options: AddVersionedDefaultsToBuilderOptions<SchemaTypes, "v3">) => Partial<NormalizeSchemeBuilderOptions<SchemaTypes>>;
    }) {
        if (!SchemaBuilder.allowPluginReRegistration && SchemaBuilder.plugins[name]) {
            throw new PothosError(`Received multiple implementations for plugin ${name}`);
        }
        SchemaBuilder.plugins[name] = plugin;
        if (normalizeOptions) {
            SchemaBuilder.optionNormalizers.set(name, normalizeOptions);
        }
    }
    objectType<Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(param: Param, options: ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>, fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>): PothosSchemaTypes.ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>> {
        verifyRef(param);
        verifyInterfaces(options.interfaces);
        const name = typeof param === "string"
            ? param
            : ((options as {
                name?: string;
            }).name ?? (param as {
                name: string;
            }).name);
        if (name === "Query" || name === "Mutation" || name === "Subscription") {
            throw new PothosSchemaError(`Invalid object name ${name} use .create${name}Type() instead`);
        }
        const ref = param instanceof BaseTypeRef
            ? (param as ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>)
            : new ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>(name);
        ref.updateConfig({
            kind: "Object",
            graphqlKind: "Object",
            name,
            interfaces: [],
            description: options.description,
            extensions: options.extensions,
            isTypeOf: options.isTypeOf,
            pothosOptions: options as PothosSchemaTypes.ObjectTypeOptions,
        });
        if (options.interfaces) {
            ref.addInterfaces(options.interfaces);
        }
        if (ref !== param && typeof param !== "string") {
            this.configStore.associateParamWithRef(param, ref);
        }
        if (fields) {
            ref.addFields(() => fields(new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(this)));
        }
        if (options.fields) {
            ref.addFields(() => {
                const t = new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(this);
                return options.fields!(t);
            });
        }
        this.configStore.addTypeRef(ref);
        return ref;
    }
    objectFields<Type extends ObjectParam<Types>>(param: Type, fields: ObjectFieldsShape<Types, ParentShape<Types, Type>>) {
        verifyRef(param);
        this.configStore.addFields(param, () => fields(new ObjectFieldBuilder<Types, ParentShape<Types, Type>>(this)));
    }
    objectField<Type extends ObjectParam<Types>>(param: Type, fieldName: string, field: ObjectFieldThunk<Types, ParentShape<Types, Type>>) {
        verifyRef(param);
        this.configStore.addFields(param, () => ({
            [fieldName]: field(new ObjectFieldBuilder<Types, ParentShape<Types, Type>>(this)),
        }));
    }
    queryType(...args: NormalizeArgs<[
        options: PothosSchemaTypes.QueryTypeOptions<Types>,
        fields?: QueryFieldsShape<Types>
    ], 0>): QueryRef<Types> {
        const [options = {}, fields] = args;
        const ref = new QueryRef<Types>(options.name ?? "Query", {
            kind: "Query",
            graphqlKind: "Object",
            name: options.name ?? "Query",
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.QueryTypeOptions,
            extensions: options.extensions,
        });
        if (ref.name !== "Query") {
            this.configStore.associateParamWithRef("Query", ref);
        }
        this.configStore.addTypeRef(ref);
        if (fields) {
            ref.addFields(() => fields(new QueryFieldBuilder(this)));
        }
        if (options.fields) {
            ref.addFields(() => options.fields!(new QueryFieldBuilder(this)));
        }
        return ref;
    }
    queryFields(fields: QueryFieldsShape<Types>) {
        this.configStore.addFields("Query", () => fields(new QueryFieldBuilder(this)));
    }
    queryField(name: string, field: QueryFieldThunk<Types>) {
        this.configStore.addFields("Query", () => ({
            [name]: field(new QueryFieldBuilder(this)),
        }));
    }
    mutationType(...args: NormalizeArgs<[
        options: PothosSchemaTypes.MutationTypeOptions<Types>,
        fields?: MutationFieldsShape<Types>
    ], 0>) {
        const [options = {}, fields] = args;
        const ref = new MutationRef<Types>(options.name ?? "Mutation", {
            kind: "Mutation",
            graphqlKind: "Object",
            name: options.name ?? "Mutation",
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.MutationTypeOptions,
            extensions: options.extensions,
        });
        this.configStore.addTypeRef(ref);
        if (ref.name !== "Mutation") {
            this.configStore.associateParamWithRef("Mutation", ref);
        }
        if (fields) {
            this.configStore.addFields("Mutation", () => fields(new MutationFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields("Mutation", () => options.fields!(new MutationFieldBuilder(this)));
        }
        return ref;
    }
    mutationFields(fields: MutationFieldsShape<Types>) {
        this.configStore.addFields("Mutation", () => fields(new MutationFieldBuilder(this)));
    }
    mutationField(name: string, field: MutationFieldThunk<Types>) {
        this.configStore.addFields("Mutation", () => ({
            [name]: field(new MutationFieldBuilder(this)),
        }));
    }
    subscriptionType(...args: NormalizeArgs<[
        options: PothosSchemaTypes.SubscriptionTypeOptions<Types>,
        fields?: SubscriptionFieldsShape<Types>
    ], 0>) {
        const [options = {}, fields] = args;
        const ref = new SubscriptionRef<Types>(options.name ?? "Subscription", {
            kind: "Subscription",
            graphqlKind: "Object",
            name: options.name ?? "Subscription",
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.SubscriptionTypeOptions,
            extensions: options.extensions,
        });
        this.configStore.addTypeRef(ref);
        if (ref.name !== "Subscription") {
            this.configStore.associateParamWithRef("Subscription", ref);
        }
        if (fields) {
            this.configStore.addFields("Subscription", () => fields(new SubscriptionFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields("Subscription", () => options.fields!(new SubscriptionFieldBuilder(this)));
        }
        return ref;
    }
    subscriptionFields(fields: SubscriptionFieldsShape<Types>) {
        this.configStore.addFields("Subscription", () => fields(new SubscriptionFieldBuilder(this)));
    }
    subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
        this.configStore.addFields("Subscription", () => ({
            [name]: field(new SubscriptionFieldBuilder(this)),
        }));
    }
    args<Shape extends InputFieldMap>(fields: (t: PothosSchemaTypes.InputFieldBuilder<Types, "Arg">) => Shape): Shape {
        return fields(new InputFieldBuilder<Types, "Arg">(this, "Arg"));
    }
    interfaceType<Param extends InterfaceParam<Types>, Interfaces extends InterfaceParam<Types>[], ResolveType>(param: Param, options: InterfaceTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces, ResolveType>, fields?: InterfaceFieldsShape<Types, ParentShape<Types, Param>>): PothosSchemaTypes.InterfaceRef<Types, AbstractReturnShape<Types, Param, ResolveType>, ParentShape<Types, Param>> {
        verifyRef(param);
        verifyInterfaces(options.interfaces);
        const name = typeof param === "string"
            ? param
            : ((options as {
                name?: string;
            }).name ?? (param as {
                name: string;
            }).name);
        const ref = param instanceof BaseTypeRef
            ? (param as InterfaceRef<Types, AbstractReturnShape<Types, Param, ResolveType>, ParentShape<Types, Param>>)
            : new InterfaceRef<Types, AbstractReturnShape<Types, Param, ResolveType>, ParentShape<Types, Param>>(name);
        const typename = ref.name;
        ref.updateConfig({
            kind: "Interface",
            graphqlKind: "Interface",
            name: typename,
            interfaces: [],
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.InterfaceTypeOptions,
            extensions: options.extensions,
            resolveType: options.resolveType as GraphQLTypeResolver<unknown, unknown>,
        });
        this.configStore.addTypeRef(ref);
        if (options.interfaces) {
            ref.addInterfaces(options.interfaces);
        }
        if (ref !== param && typeof param !== "string") {
            this.configStore.associateParamWithRef(param, ref);
        }
        if (fields) {
            this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields(ref, () => options.fields!(new InterfaceFieldBuilder(this)));
        }
        return ref;
    }
    interfaceFields<Type extends InterfaceParam<Types>>(ref: Type, fields: InterfaceFieldsShape<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(this)));
    }
    interfaceField<Type extends InterfaceParam<Types>>(ref: Type, fieldName: string, field: InterfaceFieldThunk<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.addFields(ref, () => ({
            [fieldName]: field(new InterfaceFieldBuilder(this)),
        }));
    }
    unionType<Member extends ObjectParam<Types>, ResolveType>(name: string, options: PothosSchemaTypes.UnionTypeOptions<Types, Member, ResolveType>): PothosSchemaTypes.UnionRef<Types, AbstractReturnShape<Types, Member, ResolveType>, ParentShape<Types, Member>> {
        const ref = new UnionRef<Types, AbstractReturnShape<Types, Member, ResolveType>, ParentShape<Types, Member>>(name, {
            kind: "Union",
            graphqlKind: "Union",
            name,
            types: [],
            description: options.description,
            resolveType: options.resolveType as GraphQLTypeResolver<unknown, object>,
            pothosOptions: options as unknown as PothosSchemaTypes.UnionTypeOptions,
            extensions: options.extensions,
        });
        if (Array.isArray(options.types)) {
            for (const type of options.types) {
                verifyRef(type);
            }
        }
        this.configStore.addTypeRef(ref);
        ref.addTypes(options.types);
        return ref;
    }
    enumType<Param extends EnumParam, const Values extends EnumValues<Types>>(param: Param, options: EnumTypeOptions<Types, Param, Values>): PothosSchemaTypes.EnumRef<Types, Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>> {
        verifyRef(param);
        const name = typeof param === "string" ? param : (options as {
            name: string;
        }).name;
        const values = typeof param === "object"
            ? valuesFromEnum<Types>(param as BaseEnum, options?.values as Record<string, PothosSchemaTypes.EnumValueConfig<Types>>)
            : normalizeEnumValues<Types>((options as {
                values: EnumValues<Types>;
            }).values);
        const ref = new EnumRef<Types, Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>>(name, {
            kind: "Enum",
            graphqlKind: "Enum",
            name,
            values,
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.EnumTypeOptions<Types>,
            extensions: options.extensions,
        });
        this.configStore.addTypeRef(ref);
        if (typeof param !== "string") {
            this.configStore.associateParamWithRef(param as ConfigurableRef<Types>, ref);
        }
        return ref;
    }
    scalarType<Name extends ScalarName<Types>>(name: Name, options: PothosSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>): PothosSchemaTypes.ScalarRef<Types, InputShape<Types, Name>, ParentShape<Types, Name>> {
        const ref = new ScalarRef<Types, InputShape<Types, Name>, ParentShape<Types, Name>>(name, {
            kind: "Scalar",
            graphqlKind: "Scalar",
            name,
            description: options.description,
            parseLiteral: options.parseLiteral,
            parseValue: options.parseValue,
            serialize: options.serialize as GraphQLScalarSerializer<OutputShape<Types, Name>>,
            pothosOptions: options as unknown as PothosSchemaTypes.ScalarTypeOptions,
            extensions: options.extensions,
        });
        this.configStore.addTypeRef(ref);
        return ref;
    }
    addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType, ...args: NormalizeArgs<[
        options: Omit<PothosSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, OutputShape<Types, Name>>, "serialize"> & {
            serialize?: GraphQLScalarSerializer<OutputShape<Types, Name>>;
        }
    ]>) {
        const [options = {}] = args;
        const config = scalar.toConfig();
        return this.scalarType<Name>(name, {
            ...config,
            ...options,
            extensions: {
                ...config.extensions,
                ...options.extensions,
            },
        } as PothosSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>);
    }
    inputType<Param extends InputObjectRef<Types, unknown> | string, Fields extends Param extends PothosSchemaTypes.InputObjectRef<Types, unknown> ? InputFieldsFromShape<Types, InputShape<Types, Param> & object, "InputObject"> : Param extends keyof Types["Inputs"] ? InputFieldsFromShape<Types, InputShape<Types, Param> & object, "InputObject"> : InputFieldMap, IsOneOf extends boolean = boolean>(param: Param, options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields> & {
        isOneOf?: IsOneOf;
    }): PothosSchemaTypes.InputObjectRef<Types, [
        IsOneOf
    ] extends [
        true
    ] ? OneOfInputShapeFromFields<Fields> : InputShapeFromFields<Fields>> {
        verifyRef(param);
        const name = typeof param === "string" ? param : (param as {
            name: string;
        }).name;
        const ref = (typeof param === "string"
            ? new InputObjectRef<Types, InputShapeFromFields<Fields>>(name)
            : param) as PothosSchemaTypes.InputObjectRef<Types, [
            IsOneOf
        ] extends [
            true
        ] ? OneOfInputShapeFromFields<Fields> : InputShapeFromFields<Fields>>;
        ref.updateConfig({
            kind: "InputObject",
            graphqlKind: "InputObject",
            name,
            isOneOf: options.isOneOf,
            description: options.description,
            pothosOptions: options as unknown as PothosSchemaTypes.InputObjectTypeOptions,
            extensions: options.extensions,
        } as PothosInputObjectTypeConfig & {
            isOneOf?: boolean;
        });
        this.configStore.addTypeRef(ref);
        if (param !== ref && typeof param !== "string") {
            this.configStore.associateParamWithRef(param as ConfigurableRef<Types>, ref);
        }
        this.configStore.addInputFields(ref, () => options.fields(new InputFieldBuilder(this, "InputObject")));
        return ref;
    }
    inputRef<T extends object, Normalize = true>(name: string): ImplementableInputObjectRef<Types, RecursivelyNormalizeNullableFields<T>, Normalize extends false ? T : RecursivelyNormalizeNullableFields<T>> {
        return new ImplementableInputObjectRef<Types, RecursivelyNormalizeNullableFields<T>, Normalize extends false ? T : RecursivelyNormalizeNullableFields<T>>(this, name);
    }
    objectRef<T>(name: string): ImplementableObjectRef<Types, T> {
        return new ImplementableObjectRef<Types, T>(this, name);
    }
    interfaceRef<T>(name: string): ImplementableInterfaceRef<Types, T> {
        return new ImplementableInterfaceRef<Types, T>(this, name);
    }
    toSchema(...args: NormalizeArgs<[
        options?: PothosSchemaTypes.BuildSchemaOptions<Types>
    ]>) {
        const [options = {}] = args;
        const { directives, extensions } = options;
        const scalars = [GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean];
        for (const scalar of scalars) {
            if (!this.configStore.hasImplementation(scalar.name)) {
                this.addScalarType(scalar.name as ScalarName<Types>, scalar);
            }
        }
        const buildCache = new BuildCache(this, options);
        buildCache.plugin.beforeBuild();
        buildCache.buildAll();
        const builtTypes = [...buildCache.types.values()];
        const queryName = this.configStore.hasConfig("Query")
            ? this.configStore.getTypeConfig("Query").name
            : "Query";
        const mutationName = this.configStore.hasConfig("Mutation")
            ? this.configStore.getTypeConfig("Mutation").name
            : "Mutation";
        const subscriptionName = this.configStore.hasConfig("Subscription")
            ? this.configStore.getTypeConfig("Subscription").name
            : "Subscription";
        const schema = new GraphQLSchema({
            query: buildCache.types.get(queryName) as GraphQLObjectType | undefined,
            mutation: buildCache.types.get(mutationName) as GraphQLObjectType | undefined,
            subscription: buildCache.types.get(subscriptionName) as GraphQLObjectType | undefined,
            extensions: extensions ?? {},
            directives: directives as GraphQLDirective[],
            types: builtTypes,
        });
        const processedSchema = buildCache.plugin.afterBuild(schema);
        return options.sortSchema === false
            ? processedSchema
            : lexicographicSortSchema(processedSchema);
    }
}
