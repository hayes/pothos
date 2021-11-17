// @ts-nocheck
import { GraphQLBoolean, GraphQLDirective, GraphQLFloat, GraphQLID, GraphQLInt, GraphQLIsTypeOfFn, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLString, GraphQLTypeResolver, lexicographicSortSchema, } from 'https://cdn.skypack.dev/graphql?dts';
import BuildCache from './build-cache.ts';
import ConfigStore from './config-store.ts';
import { EnumValues, InputShape, InterfaceFieldsShape, InterfaceFieldThunk, InterfaceParam, MutationFieldsShape, MutationFieldThunk, NormalizeSchemeBuilderOptions, ObjectFieldsShape, ObjectFieldThunk, ObjectParam, OutputShape, OutputType, QueryFieldsShape, QueryFieldThunk, ScalarName, SchemaTypes, ShapeFromEnumValues, SubscriptionFieldsShape, SubscriptionFieldThunk, } from './types/index.ts';
import { normalizeEnumValues, valuesFromEnum, verifyRef } from './utils/index.ts';
import { AbstractReturnShape, BaseEnum, EnumParam, EnumRef, EnumTypeOptions, GiraphQLEnumTypeConfig, GiraphQLInputObjectTypeConfig, GiraphQLInterfaceTypeConfig, GiraphQLMutationTypeConfig, GiraphQLObjectTypeConfig, GiraphQLQueryTypeConfig, GiraphQLScalarTypeConfig, GiraphQLSubscriptionTypeConfig, GiraphQLUnionTypeConfig, ImplementableInputObjectRef, ImplementableInterfaceRef, ImplementableObjectRef, InputFieldBuilder, InputFieldMap, InputFieldsFromShape, InputObjectRef, InputShapeFromFields, InterfaceFieldBuilder, InterfaceRef, InterfaceTypeOptions, MutationFieldBuilder, ObjectFieldBuilder, ObjectRef, ObjectTypeOptions, ParentShape, PluginConstructorMap, QueryFieldBuilder, ScalarRef, SubscriptionFieldBuilder, UnionRef, ValuesFromEnum, } from './index.ts';
export default class SchemaBuilder<Types extends SchemaTypes> {
    static plugins: Partial<PluginConstructorMap<SchemaTypes>> = {};
    static allowPluginReRegistration = false;
    configStore: ConfigStore<Types>;
    options: NormalizeSchemeBuilderOptions<Types>;
    defaultFieldNullability: boolean;
    defaultInputFieldRequiredness: boolean;
    constructor(options: NormalizeSchemeBuilderOptions<Types>) {
        this.options = options;
        this.configStore = new ConfigStore<Types>();
        this.defaultFieldNullability =
            (options as {
                defaultFieldNullability?: boolean;
            }).defaultFieldNullability ?? false;
        this.defaultInputFieldRequiredness =
            (options as {
                defaultInputFieldRequiredness?: boolean;
            }).defaultInputFieldRequiredness ?? false;
    }
    static registerPlugin<T extends keyof PluginConstructorMap<SchemaTypes>>(name: T, plugin: PluginConstructorMap<SchemaTypes>[T]) {
        if (!this.allowPluginReRegistration && this.plugins[name]) {
            throw new Error(`Received multiple implementations for plugin ${name}`);
        }
        this.plugins[name] = plugin;
    }
    objectType<Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(param: Param, options: ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>, fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>) {
        verifyRef(param);
        const name = typeof param === "string"
            ? param
            : (options as {
                name?: string;
            }).name ?? (param as {
                name: string;
            }).name;
        if (name === "Query" || name === "Mutation" || name === "Subscription") {
            throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
        }
        const ref = param instanceof ObjectRef
            ? (param as ObjectRef<OutputShape<Types, Param>, ParentShape<Types, Param>>)
            : new ObjectRef<OutputShape<Types, Param>, ParentShape<Types, Param>>(name);
        const config: GiraphQLObjectTypeConfig = {
            kind: "Object",
            graphqlKind: "Object",
            name,
            interfaces: (options.interfaces ?? []) as ObjectParam<SchemaTypes>[],
            description: options.description,
            extensions: options.extensions,
            isTypeOf: options.isTypeOf as GraphQLIsTypeOfFn<unknown, Types["Context"]>,
            giraphqlOptions: options as GiraphQLSchemaTypes.ObjectTypeOptions,
        };
        this.configStore.addTypeConfig(config, ref);
        if (typeof param === "function") {
            this.configStore.associateRefWithName(param, name);
        }
        if (fields) {
            this.configStore.addFields(ref, () => fields(new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(name, this)));
        }
        if (options.fields) {
            this.configStore.addFields(ref, () => {
                const t = new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(name, this);
                return options.fields!(t);
            });
        }
        return ref;
    }
    objectFields<Type extends ObjectParam<Types>>(ref: Type, fields: ObjectFieldsShape<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.onTypeConfig(ref, ({ name }) => {
            this.configStore.addFields(ref, () => fields(new ObjectFieldBuilder(name, this)));
        });
    }
    objectField<Type extends ObjectParam<Types>>(ref: Type, fieldName: string, field: ObjectFieldThunk<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.onTypeConfig(ref, ({ name }) => {
            this.configStore.addFields(ref, () => ({
                [fieldName]: field(new ObjectFieldBuilder(name, this)),
            }));
        });
    }
    queryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>, fields?: QueryFieldsShape<Types>) {
        const config: GiraphQLQueryTypeConfig = {
            kind: "Query",
            graphqlKind: "Object",
            name: "Query",
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.QueryTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config);
        if (fields) {
            this.configStore.addFields("Query", () => fields(new QueryFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields("Query", () => options.fields!(new QueryFieldBuilder(this)));
        }
    }
    queryFields(fields: QueryFieldsShape<Types>) {
        this.configStore.addFields("Query", () => fields(new QueryFieldBuilder(this)));
    }
    queryField(name: string, field: QueryFieldThunk<Types>) {
        this.configStore.addFields("Query", () => ({
            [name]: field(new QueryFieldBuilder(this)),
        }));
    }
    mutationType(options: GiraphQLSchemaTypes.MutationTypeOptions<Types>, fields?: MutationFieldsShape<Types>) {
        const config: GiraphQLMutationTypeConfig = {
            kind: "Mutation",
            graphqlKind: "Object",
            name: "Mutation",
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.MutationTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config);
        if (fields) {
            this.configStore.addFields("Mutation", () => fields(new MutationFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields("Mutation", () => options.fields!(new MutationFieldBuilder(this)));
        }
    }
    mutationFields(fields: MutationFieldsShape<Types>) {
        this.configStore.addFields("Mutation", () => fields(new MutationFieldBuilder(this)));
    }
    mutationField(name: string, field: MutationFieldThunk<Types>) {
        this.configStore.addFields("Mutation", () => ({
            [name]: field(new MutationFieldBuilder(this)),
        }));
    }
    subscriptionType(options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>, fields?: SubscriptionFieldsShape<Types>) {
        const config: GiraphQLSubscriptionTypeConfig = {
            kind: "Subscription",
            graphqlKind: "Object",
            name: "Subscription",
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.SubscriptionTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config);
        if (fields) {
            this.configStore.addFields("Subscription", () => fields(new SubscriptionFieldBuilder(this)));
        }
        if (options.fields) {
            this.configStore.addFields("Subscription", () => options.fields!(new SubscriptionFieldBuilder(this)));
        }
    }
    subscriptionFields(fields: SubscriptionFieldsShape<Types>) {
        this.configStore.addFields("Subscription", () => fields(new SubscriptionFieldBuilder(this)));
    }
    subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
        this.configStore.addFields("Subscription", () => ({
            [name]: field(new SubscriptionFieldBuilder(this)),
        }));
    }
    args<Shape extends InputFieldMap>(fields: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types, "Arg">) => Shape): Shape {
        return fields(new InputFieldBuilder<Types, "Arg">(this, "Arg", "[unknown]"));
    }
    interfaceType<Param extends InterfaceParam<Types>, Interfaces extends InterfaceParam<Types>[]>(param: Param, options: InterfaceTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>, fields?: InterfaceFieldsShape<Types, ParentShape<Types, Param>>) {
        verifyRef(param);
        const name = typeof param === "string"
            ? param
            : (options as {
                name?: string;
            }).name ?? (param as {
                name: string;
            }).name;
        const ref = param instanceof InterfaceRef
            ? (param as InterfaceRef<AbstractReturnShape<Types, Param>, ParentShape<Types, Param>>)
            : new InterfaceRef<AbstractReturnShape<Types, Param>, ParentShape<Types, Param>>(name);
        const typename = ref.name;
        const config: GiraphQLInterfaceTypeConfig = {
            kind: "Interface",
            graphqlKind: "Interface",
            name: typename,
            interfaces: (options.interfaces ?? []) as ObjectParam<SchemaTypes>[],
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.InterfaceTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config, ref);
        if (typeof param === "function") {
            this.configStore.associateRefWithName(param, name);
        }
        if (fields) {
            this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(typename, this)));
        }
        if (options.fields) {
            this.configStore.addFields(ref, () => options.fields!(new InterfaceFieldBuilder(typename, this)));
        }
        return ref;
    }
    interfaceFields<Type extends InterfaceParam<Types>>(ref: Type, fields: InterfaceFieldsShape<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.onTypeConfig(ref, ({ name }) => {
            this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(name, this)));
        });
    }
    interfaceField<Type extends InterfaceParam<Types>>(ref: Type, fieldName: string, field: InterfaceFieldThunk<Types, ParentShape<Types, Type>>) {
        verifyRef(ref);
        this.configStore.onTypeConfig(ref, ({ name }) => {
            this.configStore.addFields(ref, () => ({
                [fieldName]: field(new InterfaceFieldBuilder(name, this)),
            }));
        });
    }
    unionType<Member extends ObjectParam<Types>>(name: string, options: GiraphQLSchemaTypes.UnionTypeOptions<Types, Member>) {
        const ref = new UnionRef<AbstractReturnShape<Types, Member>, ParentShape<Types, Member>>(name);
        options.types.forEach((type) => {
            verifyRef(type);
        });
        const config: GiraphQLUnionTypeConfig = {
            kind: "Union",
            graphqlKind: "Union",
            name,
            types: (options.types || []) as ObjectParam<SchemaTypes>[],
            description: options.description,
            resolveType: options.resolveType as GraphQLTypeResolver<unknown, object>,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.UnionTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config, ref);
        return ref;
    }
    enumType<Param extends EnumParam, Values extends EnumValues<Types>>(param: Param, options: EnumTypeOptions<Types, Param, Values>) {
        verifyRef(param);
        const name = typeof param === "string" ? param : (options as {
            name: string;
        }).name;
        const ref = new EnumRef<Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>>(name);
        const values = typeof param === "object"
            ? // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                valuesFromEnum<Types>(param as BaseEnum)
            : normalizeEnumValues<Types>((options as {
                values: EnumValues<Types>;
            }).values);
        const config: GiraphQLEnumTypeConfig = {
            kind: "Enum",
            graphqlKind: "Enum",
            name,
            values,
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.EnumTypeOptions<Types>,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config, ref);
        if (typeof param !== "string") {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            this.configStore.associateRefWithName(param as BaseEnum, name);
        }
        return ref;
    }
    scalarType<Name extends ScalarName<Types>>(name: Name, options: GiraphQLSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>) {
        const ref = new ScalarRef<InputShape<Types, Name>, ParentShape<Types, Name>>(name);
        const config: GiraphQLScalarTypeConfig = {
            kind: "Scalar",
            graphqlKind: "Scalar",
            name,
            description: options.description,
            parseLiteral: options.parseLiteral,
            parseValue: options.parseValue,
            serialize: options.serialize,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.ScalarTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config, ref);
        return ref;
    }
    addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType, options: Omit<GiraphQLSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>, "description" | "parseLiteral" | "parseValue" | "serialize">) {
        const config = scalar.toConfig();
        return this.scalarType<Name>(name, {
            ...config,
            ...options,
        } as GiraphQLSchemaTypes.ScalarTypeOptions<Types, InputShape<Types, Name>, ParentShape<Types, Name>>);
    }
    inputType<Param extends InputObjectRef<unknown> | string, Fields extends Param extends GiraphQLSchemaTypes.InputObjectRef<unknown> ? InputFieldsFromShape<InputShape<Types, Param> & {}> : InputFieldMap>(param: Param, options: GiraphQLSchemaTypes.InputObjectTypeOptions<Types, Fields>): GiraphQLSchemaTypes.InputObjectRef<InputShapeFromFields<Fields>> {
        verifyRef(param);
        const name = typeof param === "string" ? param : (param as {
            name: string;
        }).name;
        const ref = (typeof param === "string" ? new InputObjectRef<InputShapeFromFields<Fields>>(name) : param) as GiraphQLSchemaTypes.InputObjectRef<InputShapeFromFields<Fields>>;
        const config: GiraphQLInputObjectTypeConfig = {
            kind: "InputObject",
            graphqlKind: "InputObject",
            name,
            description: options.description,
            giraphqlOptions: options as unknown as GiraphQLSchemaTypes.InputObjectTypeOptions,
            extensions: options.extensions,
        };
        this.configStore.addTypeConfig(config, ref);
        this.configStore.addFields(ref, () => options.fields(new InputFieldBuilder(this, "InputObject", name)));
        return ref;
    }
    inputRef<T extends object>(name: string): ImplementableInputObjectRef<Types, T> {
        return new ImplementableInputObjectRef<Types, T>(this, name);
    }
    objectRef<T>(name: string): ImplementableObjectRef<Types, T> {
        return new ImplementableObjectRef<Types, T>(this, name);
    }
    interfaceRef<T>(name: string): ImplementableInterfaceRef<Types, T> {
        return new ImplementableInterfaceRef<Types, T>(this, name);
    }
    toSchema(options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {
        const { directives, extensions } = options;
        const scalars = [GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean];
        scalars.forEach((scalar) => {
            if (!this.configStore.hasConfig(scalar.name as OutputType<Types>)) {
                this.addScalarType(scalar.name as ScalarName<Types>, scalar, {});
            }
        });
        const buildCache = new BuildCache(this, options);
        buildCache.plugin.beforeBuild();
        buildCache.buildAll();
        const builtTypes = [...buildCache.types.values()];
        const schema = new GraphQLSchema({
            query: buildCache.types.get("Query") as GraphQLObjectType | undefined,
            mutation: buildCache.types.get("Mutation") as GraphQLObjectType | undefined,
            subscription: buildCache.types.get("Subscription") as GraphQLObjectType | undefined,
            extensions,
            directives: directives as GraphQLDirective[],
            types: builtTypes,
        });
        return lexicographicSortSchema(buildCache.plugin.afterBuild(schema));
    }
}
