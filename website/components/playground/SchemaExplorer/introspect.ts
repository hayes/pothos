import {
  type GraphQLField,
  type GraphQLNamedType,
  type GraphQLSchema,
  isInterfaceType,
  isObjectType,
} from 'graphql';

export type ExplorerKind = 'query' | 'mutation' | 'subscription' | 'object' | 'interface';

export interface ExplorerField {
  name: string;
  /** Argument signature in `(arg: Type!, arg2: Type)` form, or empty when none. */
  args: string;
  /** Return type as a printable string (`User!`, `[Post!]!`, etc.). */
  returns: string;
  /** Names of named types referenced from `returns`, for click-to-jump. */
  refs: string[];
}

export interface ExplorerType {
  name: string;
  kind: ExplorerKind;
  fields: ExplorerField[];
}

export interface ExplorerSchema {
  types: ExplorerType[];
  /** Total field count across all returned types. */
  fieldCount: number;
}

const INTERNAL_TYPE_PREFIX = '__';

function namedRefs(typeStr: string): string[] {
  const refs = typeStr.match(/[A-Z][A-Za-z0-9_]*/g);
  return refs ? Array.from(new Set(refs)) : [];
}

function describeField(field: GraphQLField<unknown, unknown>): ExplorerField {
  const args = field.args.length
    ? `(${field.args.map((a) => `${a.name}: ${a.type.toString()}`).join(', ')})`
    : '';
  const returns = field.type.toString();
  return {
    name: field.name,
    args,
    returns,
    refs: namedRefs(returns),
  };
}

function describeType(type: GraphQLNamedType, kind: ExplorerKind): ExplorerType {
  if (!isObjectType(type) && !isInterfaceType(type)) {
    return { name: type.name, kind, fields: [] };
  }
  const fields = Object.values(type.getFields()).map(describeField);
  return { name: type.name, kind, fields };
}

/**
 * Build a UI-friendly view of a compiled GraphQLSchema.
 *
 * Returns Query, Mutation, Subscription roots first, then the user-defined
 * object/interface types in alphabetical order. Built-in/introspection types
 * (those starting with `__`) are skipped.
 */
export function introspectSchema(schema: GraphQLSchema): ExplorerSchema {
  const types: ExplorerType[] = [];

  const query = schema.getQueryType();
  const mutation = schema.getMutationType();
  const subscription = schema.getSubscriptionType();

  if (query) {
    types.push(describeType(query, 'query'));
  }
  if (mutation) {
    types.push(describeType(mutation, 'mutation'));
  }
  if (subscription) {
    types.push(describeType(subscription, 'subscription'));
  }

  const rootNames = new Set([query?.name, mutation?.name, subscription?.name].filter(Boolean));
  const others = Object.values(schema.getTypeMap())
    .filter(
      (t) =>
        (isObjectType(t) || isInterfaceType(t)) &&
        !t.name.startsWith(INTERNAL_TYPE_PREFIX) &&
        !rootNames.has(t.name),
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const t of others) {
    types.push(describeType(t, isInterfaceType(t) ? 'interface' : 'object'));
  }

  const fieldCount = types.reduce((acc, t) => acc + t.fields.length, 0);
  return { types, fieldCount };
}
