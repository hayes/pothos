import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf, it } from 'vitest';
import { queryFromInfo, type SelectionMap } from '../src';
import { prisma } from './example/builder';

declare const info: GraphQLResolveInfo;
declare const context: {};

// `queryFromInfo` is typed by what it was given: the `select` or `include` passed in, or, when
// neither was, whichever of the two the walked type's mode produces (both optional, so the
// result spreads into a prisma call).
it('types queryFromInfo by what was passed', () => {
  expectTypeOf(queryFromInfo({ context, info })).toEqualTypeOf<{
    select?: SelectionMap['select'];
    include?: SelectionMap['include'];
  }>();

  expectTypeOf(queryFromInfo({ context, info, select: { id: true } })).toEqualTypeOf<{
    select: { id: true };
  }>();

  expectTypeOf(queryFromInfo({ context, info, include: { posts: true } })).toEqualTypeOf<{
    include: { posts: true };
  }>();

  // Both spread into a prisma call without a cast; a given select narrows the rows.
  expectTypeOf(
    prisma.user.findMany({ ...queryFromInfo({ context, info }), where: { id: 1 } }),
  ).resolves.items.toMatchTypeOf<{ id: number; email: string }>();
  expectTypeOf(
    prisma.user.findMany({
      ...queryFromInfo({ context, info, select: { email: true } }),
      where: { id: 1 },
    }),
  ).resolves.items.toEqualTypeOf<{ email: string }>();
});
