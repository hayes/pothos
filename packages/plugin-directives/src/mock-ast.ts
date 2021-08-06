/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable no-param-reassign */
import './global-types.js';
import {
  ArgumentNode,
  DirectiveNode,
  EnumValueDefinitionNode,
  FieldDefinitionNode,
  GraphQLArgument,
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLFieldMap,
  GraphQLInputField,
  GraphQLInputFieldMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
  InputValueDefinitionNode,
  ListTypeNode,
  NamedTypeNode,
  parseValue,
  TypeNode,
  ValueNode,
} from 'graphql';
import { DirectiveList } from './types.js';

export default function mockAst(schema: GraphQLSchema) {
  const types = schema.getTypeMap();

  Object.keys(types).forEach((typeName) => {
    const type = types[typeName];

    if (type instanceof GraphQLObjectType) {
      type.astNode = {
        kind: 'ObjectTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
        interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
        fields: fieldNodes(type.getFields()),
        directives: type.extensions?.directives
          ? directiveNodes(type.extensions.directives as DirectiveList)
          : [],
      };
    } else if (type instanceof GraphQLInterfaceType) {
      type.astNode = {
        kind: 'InterfaceTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
        interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
        fields: fieldNodes(type.getFields()),
        directives: type.extensions?.directives
          ? directiveNodes(type.extensions.directives as DirectiveList)
          : [],
      };
    } else if (type instanceof GraphQLUnionType) {
      type.astNode = {
        kind: 'UnionTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
        types: type.getTypes().map((iface) => typeNode(iface) as NamedTypeNode),
        directives: type.extensions?.directives
          ? directiveNodes(type.extensions.directives as DirectiveList)
          : [],
      };
    } else if (type instanceof GraphQLEnumType) {
      type.astNode = {
        kind: 'EnumTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
        values: enumValueNodes(type.getValues()),
        directives: type.extensions?.directives
          ? directiveNodes(type.extensions.directives as DirectiveList)
          : [],
      };
    } else if (type instanceof GraphQLScalarType) {
      type.astNode = {
        kind: 'ScalarTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
        directives: type.extensions?.directives
          ? directiveNodes(type.extensions.directives as DirectiveList)
          : [],
      };
    } else if (type instanceof GraphQLInputObjectType) {
      type.astNode = {
        kind: 'InputObjectTypeDefinition',
        name: { kind: 'Name', value: typeName },
        description: type.description
          ? { kind: 'StringValue', value: type.description }
          : undefined,
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
    return { kind: 'ListType', type: typeNode(type.ofType as GraphQLType) };
  }

  if (type instanceof GraphQLNonNull) {
    return {
      kind: 'NonNullType',
      type: typeNode(type.ofType as GraphQLType) as ListTypeNode | NamedTypeNode,
    };
  }

  return { kind: 'NamedType', name: { kind: 'Name', value: type.name } };
}

function valueNode(value: unknown): ValueNode {
  if (value == null) {
    return { kind: 'NullValue' };
  }

  if (Array.isArray(value)) {
    return { kind: 'ListValue', values: value.map(valueNode) };
  }

  switch (typeof value) {
    case 'object':
      return {
        kind: 'ObjectValue',
        fields: Object.keys(value!).map((key) => ({
          kind: 'ObjectField',
          name: { kind: 'Name', value: key },
          value: valueNode((value as Record<string, unknown>)[key]),
        })),
      };
    default:
      return parseValue(JSON.stringify(value));
  }
}

function directiveNodes(directives: DirectiveList | Record<string, {}>) {
  const directiveList = Array.isArray(directives)
    ? directives
    : Object.keys(directives).map((name) => ({
        name,
        args: directives[name],
      }));

  return directiveList.map(
    (directive): DirectiveNode => ({
      kind: 'Directive',
      name: { kind: 'Name', value: directive.name },
      arguments:
        directive.args &&
        Object.keys(directive.args).map(
          (argName): ArgumentNode => ({
            kind: 'Argument',
            name: { kind: 'Name', value: argName },
            value: valueNode((directive.args as Record<string, unknown>)[argName]),
          }),
        ),
    }),
  );
}

function fieldNodes(fields: GraphQLFieldMap<unknown, unknown>): FieldDefinitionNode[] {
  return Object.keys(fields).map((fieldName) => {
    const field: GraphQLField<unknown, unknown> = fields[fieldName];

    field.astNode = {
      kind: 'FieldDefinition',
      description: field.description
        ? { kind: 'StringValue', value: field.description }
        : undefined,
      name: { kind: 'Name', value: fieldName },
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
      kind: 'InputValueDefinition',
      description: field.description
        ? { kind: 'StringValue', value: field.description }
        : undefined,
      name: { kind: 'Name', value: fieldName },
      type: typeNode(field.type),
      directives: field.extensions?.directives
        ? directiveNodes(field.extensions.directives as DirectiveList)
        : [],
    };

    return field.astNode;
  });
}

function argumentNodes(args: GraphQLArgument[]): InputValueDefinitionNode[] {
  return args.map((arg): InputValueDefinitionNode => {
    arg.astNode = {
      kind: 'InputValueDefinition',
      description: arg.description ? { kind: 'StringValue', value: arg.description } : undefined,
      name: { kind: 'Name', value: arg.name },
      type: typeNode(arg.type),
      directives: arg.extensions?.directives
        ? directiveNodes(arg.extensions.directives as DirectiveList)
        : [],
    };

    return arg.astNode;
  });
}

function enumValueNodes(values: GraphQLEnumValue[]): EnumValueDefinitionNode[] {
  return values.map((value): EnumValueDefinitionNode => {
    value.astNode = {
      kind: 'EnumValueDefinition',
      description: value.description
        ? { kind: 'StringValue', value: value.description }
        : undefined,
      name: { kind: 'Name', value: value.name },
      directives: value.extensions?.directives
        ? directiveNodes(value.extensions.directives as DirectiveList)
        : [],
    };

    return value.astNode;
  });
}
