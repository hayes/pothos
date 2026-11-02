import { describe, expect, it } from 'vitest';
import { createBuilder, run, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

// A fragment on a non-model interface expands at every level of a document, so a relation is
// planned on the interface and on each implementation. Every plan beneath it names its to-many
// slots by the position above it; those names must not make the walk beneath unshareable.
describe('planning fragments that expand at every level', () => {
  function cyclicSchema(implementations: number) {
    const builder = createBuilder();
    const calls = { posts: 0 };
    const Linked = builder.interfaceRef<object>('Linked').implement({
      fields: (t) => ({ linked: t.string({ resolve: () => 'linked' }) }),
    });
    const User = builder.prismaInterface('User', {
      variant: 'CyclicUser',
      resolveType: () => 'CyclicUser1',
      fields: (t) => ({ userId: t.exposeID('id') }),
    });
    const Post = builder.prismaInterface('Post', {
      variant: 'CyclicPost',
      resolveType: () => 'CyclicPost1',
      fields: (t) => ({ postId: t.exposeID('id') }),
    });

    builder.prismaInterfaceField(User, 'posts', (t) =>
      t.relation('posts', {
        type: Post,
        query: () => {
          calls.posts += 1;

          return {};
        },
      }),
    );
    builder.prismaInterfaceField(Post, 'author', (t) => t.relation('author', { type: User }));

    for (let n = 1; n <= implementations; n += 1) {
      builder.prismaObject('User', { variant: `CyclicUser${n}`, interfaces: [User, Linked] });
      builder.prismaObject('Post', { variant: `CyclicPost${n}`, interfaces: [Post, Linked] });
    }

    builder.queryType({
      fields: (t) => ({
        user: t.prismaField({
          type: User,
          nullable: true,
          resolve: () => db.orm.User.where({ id: 'u-bob' }),
        }),
      }),
    });

    return { calls, schema: builder.toSchema() };
  }

  function cyclicDocument(depth: number) {
    let selection = '... on Linked { linked }';

    for (let level = depth; level >= 1; level -= 1) {
      selection =
        level % 2 === 1
          ? `... on Linked { ... on CyclicUser { posts { ${selection} } } }`
          : `... on Linked { ... on CyclicPost { author { ${selection} } } }`;
    }

    return `{ user { ${selection} } }`;
  }

  it.each([
    // Walking beneath every invocation made these 174,762 and 4,473,924 calls.
    [1, 18, 18],
    [3, 12, 24],
  ])('with %i implementations at depth %i it makes %i relation calls', async (implementations, depth, expected) => {
    const { calls, schema } = cyclicSchema(implementations);
    const started = performance.now();
    const result = await run(schema, cyclicDocument(depth));

    expect(result.errors).toBeUndefined();
    expect(calls.posts).toBe(expected);
    expect(performance.now() - started).toBeLessThan(1000);
    expect(result.statements).toHaveLength(1);
  });
});
