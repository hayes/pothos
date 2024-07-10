// @ts-nocheck
import './global-types.ts';
import { defaultFieldResolver, getNamedType, GraphQLEnumType, GraphQLInputObjectType, GraphQLInputType, GraphQLInterfaceType, GraphQLNamedInputType, GraphQLNamedOutputType, GraphQLObjectType, GraphQLOutputType, GraphQLUnionType, isListType, isNonNullType, } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { ArgumentRef, EnumRef, EnumValueConfigMap, InputFieldRef, InputType, InputTypeParam, ObjectParam, ObjectRef, OutputType, SchemaTypes, TypeParam, } from '../core/index.ts';
import { AddGraphQLEnumTypeOptions, AddGraphQLInputTypeOptions, AddGraphQLInterfaceTypeOptions, AddGraphQLObjectTypeOptions, AddGraphQLUnionTypeOptions, EnumValuesWithShape, } from './types.ts';
import { addReferencedType } from './utils.ts';
const proto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
function resolveOutputTypeRef(builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>, type: GraphQLNamedOutputType) {
    addReferencedType(builder, type);
    return type.name as OutputType<SchemaTypes>;
}
function resolveInputTypeRef(builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>, type: GraphQLNamedInputType) {
    addReferencedType(builder, type);
    return type.name as InputType<SchemaTypes>;
}
function resolveOutputType(builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>, type: GraphQLOutputType): {
    type: TypeParam<SchemaTypes>;
    nullable: boolean;
} {
    const namedType = getNamedType(type);
    const isNullable = !isNonNullType(type);
    const nonNullable = isNonNullType(type) ? type.ofType : type;
    const isList = isListType(nonNullable);
    const typeRef = resolveOutputTypeRef(builder, namedType);
    if (!isList) {
        return {
            type: typeRef,
            nullable: isNullable,
        };
    }
    return {
        type: [typeRef],
        nullable: {
            list: isNullable,
            items: !isNonNullType(nonNullable.ofType),
        } as unknown as boolean,
    };
}
function resolveInputType(builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>, type: GraphQLInputType): {
    type: InputTypeParam<SchemaTypes>;
    required: boolean;
} {
    const namedType = getNamedType(type);
    const isNullable = !isNonNullType(type);
    const nonNullable = isNonNullType(type) ? type.ofType : type;
    const isList = isListType(nonNullable);
    const typeRef = resolveInputTypeRef(builder, namedType);
    if (!isList) {
        return {
            type: typeRef,
            required: !isNullable,
        };
    }
    return {
        type: [typeRef],
        required: {
            list: !isNullable,
            items: isNonNullType(nonNullable.ofType),
        } as unknown as boolean,
    };
}
proto.addGraphQLObject = function addGraphQLObject<Shape>(type: GraphQLObjectType<Shape>, { fields, extensions, ...options }: AddGraphQLObjectTypeOptions<SchemaTypes, Shape> = {}) {
    const typeOptions = {
        ...options,
        description: type.description ?? undefined,
        isTypeOf: type.isTypeOf as never,
        extensions: { ...type.extensions, ...extensions },
        interfaces: () => type.getInterfaces().map((i) => resolveOutputTypeRef(this, i)) as [
        ],
        fields: (t: PothosSchemaTypes.ObjectFieldBuilder<SchemaTypes, Shape>) => {
            const existingFields = type.getFields();
            const newFields = fields?.(t) ?? {};
            const combinedFields: typeof newFields = {
                ...newFields,
            };
            Object.entries(existingFields).forEach(([fieldName, field]) => {
                if (newFields[fieldName] !== undefined) {
                    if (newFields[fieldName] === null) {
                        delete combinedFields[fieldName];
                    }
                    return;
                }
                const args: Record<string, ArgumentRef<SchemaTypes>> = {};
                for (const { name, ...arg } of field.args) {
                    const input = resolveInputType(this, arg.type);
                    args[name] = t.arg({
                        ...input,
                        description: arg.description ?? undefined,
                        deprecationReason: arg.deprecationReason ?? undefined,
                        defaultValue: arg.defaultValue,
                        extensions: arg.extensions,
                    });
                }
                combinedFields[fieldName] = t.field({
                    ...resolveOutputType(this, field.type),
                    args,
                    description: field.description ?? undefined,
                    deprecationReason: field.deprecationReason ?? undefined,
                    resolve: (field.resolve ?? defaultFieldResolver) as never,
                });
            });
            return combinedFields as {};
        },
    };
    switch (type.name) {
        case "Query":
            this.queryType(typeOptions as never);
            return "Query" as never;
        case "Mutation":
            this.mutationType(typeOptions as never);
            return "Mutation" as never;
        case "Subscription":
            this.subscriptionType(typeOptions as never);
            return "Subscription" as never;
        default:
            return this.objectRef<Shape>(options?.name ?? type.name).implement(typeOptions as never);
    }
};
proto.addGraphQLInterface = function addGraphQLInterface<Shape = unknown>(type: GraphQLInterfaceType, { fields, extensions, ...options }: AddGraphQLInterfaceTypeOptions<SchemaTypes, Shape> = {}) {
    const ref = this.interfaceRef<Shape>(options?.name ?? type.name);
    ref.implement({
        ...options,
        description: type.description ?? undefined,
        resolveType: type.resolveType as never,
        extensions: { ...type.extensions, ...extensions },
        interfaces: () => type.getInterfaces().map((i) => resolveOutputTypeRef(this, i)) as [
        ],
        fields: (t) => {
            const existingFields = type.getFields();
            const newFields = fields?.(t) ?? {};
            const combinedFields: typeof newFields = {
                ...newFields,
            };
            Object.entries(existingFields).forEach(([fieldName, field]) => {
                if (newFields[fieldName] !== undefined) {
                    if (newFields[fieldName] === null) {
                        delete combinedFields[fieldName];
                    }
                    return;
                }
                const args: Record<string, ArgumentRef<SchemaTypes>> = {};
                for (const { name, ...arg } of field.args) {
                    args[name] = t.arg({
                        ...resolveInputType(this, arg.type),
                        description: arg.description ?? undefined,
                        deprecationReason: arg.deprecationReason ?? undefined,
                        defaultValue: arg.defaultValue,
                        extensions: arg.extensions,
                    });
                }
                combinedFields[fieldName] = t.field({
                    ...resolveOutputType(this, field.type),
                    args,
                    description: field.description ?? undefined,
                    deprecationReason: field.deprecationReason ?? undefined,
                    resolve: field.resolve as never,
                });
            });
            return combinedFields as {};
        },
    });
    return ref;
};
proto.addGraphQLUnion = function addGraphQLUnion<Shape>(type: GraphQLUnionType, { types, extensions, ...options }: AddGraphQLUnionTypeOptions<SchemaTypes, ObjectRef<SchemaTypes, Shape>> = {}) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.unionType<ObjectParam<SchemaTypes>, Shape>(options?.name ?? type.name, {
        ...options,
        description: type.description ?? undefined,
        resolveType: type.resolveType as never,
        extensions: { ...type.extensions, ...extensions },
        types: types ?? (type.getTypes().map((t) => resolveOutputTypeRef(this, t)) as [
        ]),
    });
};
proto.addGraphQLEnum = function addGraphQLEnum<Shape extends number | string>(type: GraphQLEnumType, { values, extensions, ...options }: AddGraphQLEnumTypeOptions<SchemaTypes, EnumValuesWithShape<SchemaTypes, Shape>> = {}) {
    const newValues = values ??
        type.getValues().reduce<EnumValueConfigMap<SchemaTypes>>((acc, value) => {
            acc[value.name] = {
                value: value.value as never,
                description: value.description ?? undefined,
                deprecationReason: value.deprecationReason ?? undefined,
                extensions: value.extensions,
            };
            return acc;
        }, {});
    const ref: EnumRef<SchemaTypes, Shape> = this.enumType<never, EnumValuesWithShape<SchemaTypes, Shape>>((options?.name ?? type.name) as never, {
        ...options,
        description: type.description ?? undefined,
        extensions: { ...type.extensions, ...extensions },
        values: newValues,
    } as never);
    return ref;
};
proto.addGraphQLInput = function addGraphQLInput<Shape extends {}>(type: GraphQLInputObjectType, { name = type.name, fields, extensions, ...options }: AddGraphQLInputTypeOptions<SchemaTypes, Shape> = {}) {
    const ref = this.inputRef<Shape>(name);
    return ref.implement({
        ...options,
        description: type.description ?? undefined,
        extensions: { ...type.extensions, ...extensions },
        fields: (t) => {
            const existingFields = type.getFields();
            const newFields: Record<string, InputFieldRef<SchemaTypes, unknown> | null> = fields?.(t) ?? {};
            const combinedFields: typeof newFields = {
                ...newFields,
            };
            Object.entries(existingFields).forEach(([fieldName, field]) => {
                if (newFields[fieldName] !== undefined) {
                    if (newFields[fieldName] === null) {
                        delete combinedFields[fieldName];
                    }
                    return;
                }
                combinedFields[fieldName] = t.field({
                    ...resolveInputType(this, field.type),
                    description: field.description ?? undefined,
                    defaultValue: field.defaultValue,
                    extensions: field.extensions,
                });
            });
            return combinedFields as never;
        },
    }) as never;
};
