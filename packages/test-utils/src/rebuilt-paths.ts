import {
  defaultFieldResolver,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  isObjectType,
} from 'graphql';

type Path = GraphQLResolveInfo['path'];

function rebuilt(path: Path | undefined): Path | undefined {
  return path && ({ key: path.key, prev: rebuilt(path.prev) } as Path);
}

/**
 * Wraps the resolvers of `schema` so that, for a context `rebuildPaths` accepts, each gets its info
 * as graphql-jit builds it: a path of its own, sharing no link with any other resolver's and
 * without a `typename`, and no `getAbortSignal`.
 */
export function rebuildResolverPaths<Context>(
  schema: GraphQLSchema,
  rebuildPaths: (context: Context) => boolean,
) {
  for (const type of Object.values(schema.getTypeMap())) {
    if (isObjectType(type) && !type.name.startsWith('__')) {
      for (const field of Object.values(type.getFields())) {
        const resolve = field.resolve ?? defaultFieldResolver;

        field.resolve = (parent, args, context: Context, info) =>
          resolve(
            parent,
            args,
            context,
            rebuildPaths(context)
              ? ({ ...info, path: rebuilt(info.path), getAbortSignal: undefined } as never)
              : info,
          );
      }
    }
  }
}
