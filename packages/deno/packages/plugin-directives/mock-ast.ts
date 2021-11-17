// @ts-nocheck
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-param-reassign */
import './global-types.ts';
import { ConstArgumentNode, ConstDirectiveNode, ConstValueNode, DirectiveNode, EnumValueDefinitionNode, FieldDefinitionNode, GraphQLArgument, GraphQLEnumType, GraphQLEnumValue, GraphQLField, GraphQLFieldMap, GraphQLInputField, GraphQLInputFieldMap, GraphQLInputObjectType, GraphQLInterfaceType, GraphQLList, GraphQLNonNull, GraphQLObjectType, GraphQLScalarType, GraphQLSchema, GraphQLType, GraphQLUnionType, InputValueDefinitionNode, Kind, ListTypeNode, NamedTypeNode, parseValue, TypeNode, } from 'https://cdn.skypack.dev/graphql?dts';
import { DirectiveList } from './types.ts';
export default function mockAst(schema: GraphQLSchema) {
    const types = schema.getTypeMap();
    Object.keys(types).forEach((typeName) => {
        const type = types[typeName];
        if (type instanceof GraphQLObjectType) {
            type.astNode = {
                kind: Kind.OBJECT_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
                fields: fieldNodes(type.getFields()),
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
        else if (type instanceof GraphQLInterfaceType) {
            type.astNode = {
                kind: Kind.INTERFACE_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
                fields: fieldNodes(type.getFields()),
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
        else if (type instanceof GraphQLUnionType) {
            type.astNode = {
                kind: Kind.UNION_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                types: type.getTypes().map((iface) => typeNode(iface) as NamedTypeNode),
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
        else if (type instanceof GraphQLEnumType) {
            type.astNode = {
                kind: Kind.ENUM_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                values: enumValueNodes(type.getValues()),
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
        else if (type instanceof GraphQLScalarType) {
            type.astNode = {
                kind: Kind.SCALAR_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
        else if (type instanceof GraphQLInputObjectType) {
            type.astNode = {
                kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
                name: { kind: Kind.NAME, value: typeName },
                description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
                fields: inputFieldNodes(type.getFields()),
                directives: type.extensions?.directives
                    ? directiveNodes(type.extensions.directives as DirectiveList)
                    : [],
            };
        }
    });
}
function typeNode(type: GraphQLType): TypeNode {
    if (type instanceof GraphQLList) {
        return { kind: Kind.LIST_TYPE, type: typeNode(type.ofType) };
    }
    if (type instanceof GraphQLNonNull) {
        return {
            kind: Kind.NON_NULL_TYPE,
            type: typeNode(type.ofType as GraphQLType) as ListTypeNode | NamedTypeNode,
        };
    }
    return { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: type.name } };
}
function valueNode(value: unknown): ConstValueNode {
    if (value == null) {
        return { kind: Kind.NULL };
    }
    if (Array.isArray(value)) {
        return { kind: Kind.LIST, values: value.map(valueNode) };
    }
    switch (typeof value) {
        case "object":
            return {
                kind: Kind.OBJECT,
                fields: Object.keys(value!).map((key) => ({
                    kind: Kind.OBJECT_FIELD,
                    name: { kind: Kind.NAME, value: key },
                    value: valueNode((value as Record<string, unknown>)[key]),
                })),
            };
        default:
            return parseValue(JSON.stringify(value)) as ConstValueNode;
    }
}
function directiveNodes(directives: DirectiveList | Record<string, {}>): readonly ConstDirectiveNode[] {
    const directiveList = Array.isArray(directives)
        ? directives
        : Object.keys(directives).map((name) => ({
            name,
            args: directives[name],
        }));
    return directiveList.map((directive): DirectiveNode => ({
        kind: Kind.DIRECTIVE,
        name: { kind: Kind.NAME, value: directive.name },
        arguments: directive.args &&
            Object.keys(directive.args).map((argName): ConstArgumentNode => ({
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: argName },
                value: valueNode((directive.args as Record<string, unknown>)[argName]),
            })),
    })) as readonly ConstDirectiveNode[];
}
function fieldNodes(fields: GraphQLFieldMap<unknown, unknown>): FieldDefinitionNode[] {
    return Object.keys(fields).map((fieldName) => {
        const field: GraphQLField<unknown, unknown> = fields[fieldName];
        field.astNode = {
            kind: Kind.FIELD_DEFINITION,
            description: field.description ? { kind: Kind.STRING, value: field.description } : undefined,
            name: { kind: Kind.NAME, value: fieldName },
            arguments: argumentNodes(field.args),
            type: typeNode(field.type),
            directives: field.extensions?.directives
                ? directiveNodes(field.extensions.directives as DirectiveList)
                : [],
        };
        return field.astNode;
    });
}
function inputFieldNodes(fields: GraphQLInputFieldMap): InputValueDefinitionNode[] {
    return Object.keys(fields).map((fieldName) => {
        const field: GraphQLInputField = fields[fieldName];
        field.astNode = {
            kind: Kind.INPUT_VALUE_DEFINITION,
            description: field.description ? { kind: Kind.STRING, value: field.description } : undefined,
            name: { kind: Kind.NAME, value: fieldName },
            type: typeNode(field.type),
            directives: field.extensions?.directives
                ? directiveNodes(field.extensions.directives as DirectiveList)
                : [],
        };
        return field.astNode;
    });
}
function argumentNodes(args: readonly GraphQLArgument[]): InputValueDefinitionNode[] {
    return args.map((arg): InputValueDefinitionNode => {
        arg.astNode = {
            kind: Kind.INPUT_VALUE_DEFINITION,
            description: arg.description ? { kind: Kind.STRING, value: arg.description } : undefined,
            name: { kind: Kind.NAME, value: arg.name },
            type: typeNode(arg.type),
            directives: arg.extensions?.directives
                ? directiveNodes(arg.extensions.directives as DirectiveList)
                : [],
        };
        return arg.astNode;
    });
}
function enumValueNodes(values: readonly GraphQLEnumValue[]): readonly EnumValueDefinitionNode[] {
    return values.map((value): EnumValueDefinitionNode => {
        value.astNode = {
            kind: Kind.ENUM_VALUE_DEFINITION,
            description: value.description ? { kind: Kind.STRING, value: value.description } : undefined,
            name: { kind: Kind.NAME, value: value.name },
            directives: value.extensions?.directives
                ? directiveNodes(value.extensions.directives as DirectiveList)
                : [],
        };
        return value.astNode;
    });
}
