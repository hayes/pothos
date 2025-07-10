import './global-types';
import {
  type ArgumentNode,
  astFromValue,
  type ConstDirectiveNode,
  type ConstValueNode,
  type DirectiveNode,
  type EnumValueDefinitionNode,
  type FieldDefinitionNode,
  type GraphQLArgument,
  GraphQLEnumType,
  type GraphQLEnumValue,
  type GraphQLField,
  type GraphQLFieldMap,
  type GraphQLInputField,
  type GraphQLInputFieldMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  type GraphQLSchema,
  type GraphQLType,
  GraphQLUnionType,
  type InputValueDefinitionNode,
  Kind,
  type ListTypeNode,
  type NamedTypeNode,
  type OperationTypeNode,
  parseValue,
  type TypeNode,
  type ValueNode,
} from 'graphql';
import type { DirectiveList } from './types';

export default function mockAst(schema: GraphQLSchema) {
  const types = schema.getTypeMap();

  schema.extensionASTNodes = [
    {
      kind: Kind.SCHEMA_EXTENSION,
      directives: directiveNodes(schema.extensions?.directives as DirectiveList, null, schema),
      operationTypes: (
        [
          {
            operation: 'query' as OperationTypeNode,
            node: schema.getQueryType(),
          },
          {
            operation: 'mutation' as OperationTypeNode,
            node: schema.getMutationType(),
          },
          {
            operation: 'subscription' as OperationTypeNode,
            node: schema.getSubscriptionType(),
          },
        ] as const
      )
        .filter(
          ({ node, operation }) =>
            node && node.name !== `${operation[0].toUpperCase()}${operation.slice(1)}`,
        )
        .map(({ operation, node }) => ({
          kind: Kind.OPERATION_TYPE_DEFINITION,
          operation,
          type: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: node!.name } },
        })),
    },
  ];

  for (const typeName of Object.keys(types)) {
    const type = types[typeName];

    if (type instanceof GraphQLObjectType) {
      type.astNode = {
        kind: Kind.OBJECT_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
        fields: fieldNodes(type.getFields(), schema),
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    } else if (type instanceof GraphQLInterfaceType) {
      type.astNode = {
        kind: Kind.INTERFACE_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        interfaces: type.getInterfaces().map((iface) => typeNode(iface) as NamedTypeNode),
        fields: fieldNodes(type.getFields(), schema),
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    } else if (type instanceof GraphQLUnionType) {
      type.astNode = {
        kind: Kind.UNION_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        types: type.getTypes().map((iface) => typeNode(iface) as NamedTypeNode),
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    } else if (type instanceof GraphQLEnumType) {
      type.astNode = {
        kind: Kind.ENUM_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        values: enumValueNodes(type.getValues(), schema),
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    } else if (type instanceof GraphQLScalarType) {
      type.astNode = {
        kind: Kind.SCALAR_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    } else if (type instanceof GraphQLInputObjectType) {
      type.astNode = {
        kind: Kind.INPUT_OBJECT_TYPE_DEFINITION,
        name: { kind: Kind.NAME, value: typeName },
        description: type.description ? { kind: Kind.STRING, value: type.description } : undefined,
        fields: inputFieldNodes(type.getFields(), schema),
        directives: directiveNodes(type.extensions?.directives as DirectiveList, null, schema),
      };
    }
  }
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

function valueNode(value: unknown, arg?: GraphQLArgument): ValueNode {
  if (value == null) {
    return { kind: Kind.NULL };
  }

  if (arg) {
    return astFromValue(value, arg.type) as ValueNode;
  }

  if (Array.isArray(value)) {
    return { kind: Kind.LIST, values: value.map((val) => valueNode(val)) };
  }

  switch (typeof value) {
    case 'object':
      return {
        kind: Kind.OBJECT,
        fields: Object.keys(value!).map((key) => ({
          kind: Kind.OBJECT_FIELD,
          name: { kind: Kind.NAME, value: key },
          value: valueNode((value as Record<string, unknown>)[key]),
        })),
      };
    default:
      return parseValue(JSON.stringify(value));
  }
}

function directiveNodes(
  rawDirectives: DirectiveList | Record<string, object> | undefined,
  deprecationReason: string | null,
  schema: GraphQLSchema,
): readonly ConstDirectiveNode[] {
  if (!rawDirectives && !deprecationReason) {
    return [];
  }

  const directives = rawDirectives ?? [];
  const directiveList = Array.isArray(directives)
    ? directives
    : Object.keys(directives).flatMap((name) =>
        Array.isArray(directives[name])
          ? (directives[name] as object[]).map((args) => ({
              name,
              args,
            }))
          : {
              name,
              args: directives[name],
            },
      );

  if (deprecationReason) {
    const deprecatedIndex = directiveList.findIndex((directive) => directive.name === 'deprecated');
    const deprecatedDirective = {
      name: 'deprecated',
      args: {
        reason: deprecationReason!,
      },
    };

    if (deprecatedIndex === -1) {
      directiveList.unshift(deprecatedDirective);
    } else {
      directiveList[deprecatedIndex] = deprecatedDirective;
    }
  }

  return directiveList.map((directive): DirectiveNode => {
    const directiveDef = schema.getDirective(directive.name);
    directiveDef?.args.find((arg) => arg.name);
    return {
      kind: Kind.DIRECTIVE,
      name: { kind: Kind.NAME, value: directive.name },
      arguments:
        directive.args &&
        Object.keys(directive.args).map(
          (argName): ArgumentNode => ({
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: argName },
            value: valueNode(
              (directive.args as Record<string, unknown>)[argName],
              directiveDef?.args.find((arg) => arg.name === argName),
            ),
          }),
        ),
    };
  }) as readonly ConstDirectiveNode[];
}

function fieldNodes(
  fields: GraphQLFieldMap<unknown, unknown>,
  schema: GraphQLSchema,
): FieldDefinitionNode[] {
  return Object.keys(fields).map((fieldName) => {
    const field: GraphQLField<unknown, unknown> = fields[fieldName];

    field.astNode = {
      kind: Kind.FIELD_DEFINITION,
      description: field.description ? { kind: Kind.STRING, value: field.description } : undefined,
      name: { kind: Kind.NAME, value: fieldName },
      arguments: argumentNodes(field.args, schema),
      type: typeNode(field.type),
      directives: directiveNodes(
        field.extensions?.directives as DirectiveList,
        field.deprecationReason ?? null,
        schema,
      ),
    };

    return field.astNode!;
  });
}

function inputFieldNodes(
  fields: GraphQLInputFieldMap,
  schema: GraphQLSchema,
): InputValueDefinitionNode[] {
  return Object.keys(fields).map((fieldName) => {
    const field: GraphQLInputField = fields[fieldName];

    const defaultValueNode = astFromValue(field.defaultValue, field.type) as ConstValueNode;

    field.astNode = {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: field.description ? { kind: Kind.STRING, value: field.description } : undefined,
      name: { kind: Kind.NAME, value: fieldName },
      type: typeNode(field.type),
      defaultValue: field.defaultValue === undefined ? undefined : defaultValueNode,
      directives: directiveNodes(
        field.extensions?.directives as DirectiveList,
        field.deprecationReason ?? null,
        schema,
      ),
    };

    return field.astNode!;
  });
}

function argumentNodes(
  args: readonly GraphQLArgument[],
  schema: GraphQLSchema,
): InputValueDefinitionNode[] {
  return args.map((arg): InputValueDefinitionNode => {
    const defaultValueNode = astFromValue(arg.defaultValue, arg.type) as ConstValueNode;

    arg.astNode = {
      kind: Kind.INPUT_VALUE_DEFINITION,
      description: arg.description ? { kind: Kind.STRING, value: arg.description } : undefined,
      name: { kind: Kind.NAME, value: arg.name },
      type: typeNode(arg.type),
      defaultValue: arg.defaultValue === undefined ? undefined : defaultValueNode,
      directives: directiveNodes(
        arg.extensions?.directives as DirectiveList,
        arg.deprecationReason ?? null,
        schema,
      ),
    };

    return arg.astNode;
  });
}

function enumValueNodes(
  values: readonly GraphQLEnumValue[],
  schema: GraphQLSchema,
): readonly EnumValueDefinitionNode[] {
  return values.map((value): EnumValueDefinitionNode => {
    value.astNode = {
      kind: Kind.ENUM_VALUE_DEFINITION,
      description: value.description ? { kind: Kind.STRING, value: value.description } : undefined,
      name: { kind: Kind.NAME, value: value.name },
      directives: directiveNodes(
        value.extensions?.directives as DirectiveList,
        value.deprecationReason ?? null,
        schema,
      ),
    };

    return value.astNode;
  });
}
