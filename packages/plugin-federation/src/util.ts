import type { SchemaTypes } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { KeyDirective, Selection } from './types';

type DirectiveList = { name: string; args?: object }[];
type DirectiveOption = DirectiveList | Record<string, object>;

export function keyDirective(key: KeyDirective<object> | KeyDirective<object>[]): {
  name: string;
  args?: object;
}[] {
  if (Array.isArray(key)) {
    return key.map(({ selection, resolvable }) => ({
      name: 'key',
      args: { fields: selection, ...(resolvable === undefined ? {} : { resolvable }) },
    }));
  }

  return [
    {
      name: 'key',
      args: {
        fields: key.selection,
        ...(key.resolvable === undefined ? {} : { resolvable: key.resolvable }),
      },
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
  // biome-ignore lint/suspicious/noExplicitAny: this is fine
  PothosSchemaTypes.SchemaBuilder<any>,
  Map<
    string,
    {
      key: Selection<object> | Selection<object>[];
      interfaceObject?: boolean;
      resolveReference?: (val: object, context: {}, info: GraphQLResolveInfo) => unknown;
    }
  >
>();

// biome-ignore lint/suspicious/noExplicitAny: this is fine
export const usedDirectives = new Map<PothosSchemaTypes.SchemaBuilder<any>, Set<string>>();

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
  for (const directive of directives) {
    set.add(directive);
  }
}
