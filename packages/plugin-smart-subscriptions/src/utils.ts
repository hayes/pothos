import { GraphQLResolveInfo } from 'graphql';

export function rootName(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return rootName(path.prev);
  }

  return String(path.key);
}

export function stringPath(path: GraphQLResolveInfo['path']): string {
  if (path.prev) {
    return `${stringPath(path.prev)}.${path.key}`;
  }

  return String(path.key);
}
