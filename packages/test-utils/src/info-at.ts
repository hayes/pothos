import type { GraphQLResolveInfo } from 'graphql';

type Path = GraphQLResolveInfo['path'];

/**
 * The info of the field at `keys`, from the root field down, in the execution `info` is from,
 * with the path its executor would build: beneath the root link of `info.path`, each field's link
 * carrying a `typename`, as graphql-js and @graphql-tools/executor link them; or, where `info.path`
 * has no `typename` (graphql-jit), a chain of its own without one. The `typename` given is a
 * placeholder, not the parent type's name.
 */
export function infoAt(info: GraphQLResolveInfo, ...keys: (string | number)[]): GraphQLResolveInfo {
  const [rootKey, ...rest] = keys;
  let root = info.path;

  while (root.prev) {
    root = root.prev;
  }

  if (root.key !== rootKey) {
    throw new Error(`infoAt: info is beneath the root field ${root.key}, not ${rootKey}`);
  }

  const linked = info.path.typename !== undefined;
  let path: Path = linked ? root : { prev: undefined, key: rootKey, typename: undefined };

  for (const key of rest) {
    path = { prev: path, key, typename: linked && typeof key === 'string' ? 'Type' : undefined };
  }

  return { ...info, path };
}
