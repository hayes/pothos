import {
  type GraphQLFieldConfigMap,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  type GraphQLOutputType,
  GraphQLUnionType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isUnionType,
} from 'graphql';

export type OutputTypeMap = Map<GraphQLOutputType, GraphQLOutputType>;

export function replaceOutputFields(
  fields: GraphQLFieldConfigMap<unknown, unknown>,
  replacements: OutputTypeMap,
): GraphQLFieldConfigMap<unknown, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [
      name,
      { ...field, type: replaceOutputType(field.type, replacements) },
    ]),
  );
}

// Cache each replacement before evaluating its fields or members so recursive
// output graphs retain a single identity for every named type.
export function replaceOutputType<Type extends GraphQLOutputType>(
  type: Type,
  replacements: OutputTypeMap,
): Type {
  const existing = replacements.get(type);
  if (existing) {
    return existing as Type;
  }

  let replacement: GraphQLOutputType;
  if (isNonNullType(type)) {
    replacement = new GraphQLNonNull(replaceOutputType(type.ofType, replacements));
  } else if (isListType(type)) {
    replacement = new GraphQLList(replaceOutputType(type.ofType, replacements));
  } else if (isObjectType(type)) {
    const config = type.toConfig();
    replacement = new GraphQLObjectType({
      ...config,
      interfaces: () => config.interfaces.map((iface) => replaceOutputType(iface, replacements)),
      fields: () => replaceOutputFields(config.fields, replacements),
    });
  } else if (isInterfaceType(type)) {
    const config = type.toConfig();
    replacement = new GraphQLInterfaceType({
      ...config,
      interfaces: () => config.interfaces.map((iface) => replaceOutputType(iface, replacements)),
      fields: () => replaceOutputFields(config.fields, replacements),
    });
  } else if (isUnionType(type)) {
    const config = type.toConfig();
    replacement = new GraphQLUnionType({
      ...config,
      types: () => config.types.map((member) => replaceOutputType(member, replacements)),
    });
  } else {
    return type;
  }
  replacements.set(type, replacement);
  return replacement as Type;
}
