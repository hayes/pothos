import { GraphQLResolveInfo } from 'graphql';
import { SchemaTypes } from '@pothos/core';
import { Selection } from './types';

type DirectiveList = { name: string; args?: {} }[];
type DirectiveOption = DirectiveList | Record<string, {}>;

export function keyDirective(key: Selection<object> | Selection<object>[]): {
  name: string;
  args?: {};
}[] {
  if (Array.isArray(key)) {
    return key.map(({ selection }) => ({
      name: 'key',
      args: { fields: selection },
    }));
  }

  return [
    {
      name: 'key',
      args: { fields: key.selection },
    },
  ];
}

export function mergeDirectives(
  existing: DirectiveOption | undefined,
  add: DirectiveList,
): DirectiveList {
  if (!existing) {
    return [...add];
  }

  if (Array.isArray(existing)) {
    return [...existing, ...add];
  }

  return [...Object.keys(existing).map((name) => ({ name, args: existing[name] })), ...add];
}

export const entityMapping = new WeakMap<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PothosSchemaTypes.SchemaBuilder<any>,
  Map<
    string,
    {
      key: Selection<object> | Selection<object>[];
      interfaceObject?: boolean;
      resolveReference: (val: object, context: {}, info: GraphQLResolveInfo) => unknown;
    }
  >
>();

export const usedDirectives = new Map<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PothosSchemaTypes.SchemaBuilder<any>,
  Set<string>
>();

export function getUsedDirectives<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  builder.toSchema();
  return [...(usedDirectives.get(builder) ?? new Set())]
    .map((d) => (d.startsWith('@') ? d : `@${d}`))
    .sort();
}

export function addUsedDirectives<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  directives: string[],
): void {
  if (!usedDirectives.has(builder)) {
    usedDirectives.set(builder, new Set());
  }

  const set = usedDirectives.get(builder)!;
  directives.forEach((directive) => set.add(directive));
}
