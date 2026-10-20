import type { ObjectParam, SchemaTypes } from '../types/index.js';
import { isThenable } from './index.js';

type UnionMembers<Types extends SchemaTypes> =
  | ObjectParam<Types>[]
  | Record<string, ObjectParam<Types>>;

function memberList<Types extends SchemaTypes>(members: UnionMembers<Types>) {
  return Array.isArray(members) ? members : Object.values(members);
}

/**
 * Converts union options whose `types` is a record into the array form. `resolveType` then
 * returns a key of the record, which is mapped back to its member. Options with an array are
 * returned unchanged.
 */
export function normalizeUnionOptions<Types extends SchemaTypes>(
  options:
    | PothosSchemaTypes.UnionTypeOptions<Types>
    | PothosSchemaTypes.UnionTypeRecordOptions<Types>,
): PothosSchemaTypes.UnionTypeOptions<Types> {
  const { types, resolveType } = options;

  if (Array.isArray(types)) {
    return options as PothosSchemaTypes.UnionTypeOptions<Types>;
  }

  // A thunk may return either form, so it is only called once the schema is built.
  let members: UnionMembers<Types> | undefined;
  const getMembers = () => {
    members ??= typeof types === 'function' ? types() : types;

    return members;
  };

  const toMember = (result: unknown) => {
    const resolved = getMembers();

    return !Array.isArray(resolved) && typeof result === 'string' && Object.hasOwn(resolved, result)
      ? resolved[result]
      : result;
  };

  return {
    ...options,
    types: typeof types === 'function' ? () => memberList(getMembers()) : memberList(types),
    resolveType:
      resolveType &&
      (((...args: unknown[]) => {
        const result = (resolveType as (...args: unknown[]) => unknown)(...args);

        return isThenable(result) ? result.then(toMember) : toMember(result);
      }) as PothosSchemaTypes.UnionTypeOptions<Types>['resolveType']),
  } as PothosSchemaTypes.UnionTypeOptions<Types>;
}
