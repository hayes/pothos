import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { graphql } from 'graphql';
import { checkMediaConnections } from './connections-check';
import { createDatabase } from './db';
import { createSchema } from './schema';

async function check() {
  const { prisma, statements, close } = await createDatabase();
  try {
    const schema = createSchema(prisma);
    const run = async (source: string, userId = 1, variableValues?: Record<string, unknown>) => {
      const result = await graphql({ schema, source, contextValue: { userId }, variableValues });
      assert.equal(result.errors, undefined, JSON.stringify(result.errors));
      return JSON.parse(JSON.stringify(result.data));
    };
    const author = await run(
      '{ author(id: 1) { name bio postCount posts { title author { name } media { url uploadedBy { name } } } } }',
    );
    assert.equal(author.author.postCount, 2);
    assert.equal(author.author.bio, 'Writes about community gardens.');
    assert.deepEqual(
      author.author.posts.map((post: { title: string }) => post.title),
      ['A guide to composting', 'Starting a seed library'],
    );
    assert.equal(author.author.posts[0].media[0].uploadedBy.name, 'Leo Silva');
    assert.deepEqual(
      await run('{ author(id: 3) { bio posts { title } } missing: author(id: 999) { name } }'),
      {
        author: { bio: null, posts: [] },
        missing: null,
      },
    );
    statements.length = 0;
    await run('{ author(id: 1) { name } }');
    assert.ok(!statements.some((sql) => sql.includes('Profile') || sql.includes('Post')));
    const simpleCount = statements.length;
    statements.length = 0;
    const aliases = await run(
      '{ author(id: 1) { newest: posts { title } oldest: posts(oldestFirst: true) { title } } }',
    );
    assert.deepEqual(aliases.author.newest, [...aliases.author.oldest].reverse());
    assert.ok(
      statements.length > simpleCount,
      'incompatible relation aliases execute additional SQL',
    );
    assert.deepEqual(
      await run(
        '{ me { __typename email drafts { title } ... on EditorViewer { canReviewSubmissions } } }',
      ),
      {
        me: {
          __typename: 'EditorViewer',
          email: 'maya@example.com',
          drafts: [{ title: 'Planning the spring exchange' }],
          canReviewSubmissions: true,
        },
      },
    );
    assert.deepEqual(await run('{ me { __typename drafts { title } } }', 2), {
      me: { __typename: 'AuthorViewer', drafts: [{ title: 'Saving rainwater' }] },
    });
    const id = Buffer.from('Post:5').toString('base64');
    assert.deepEqual(await run('query($id: ID!) { node(id: $id) { id } }', 1, { id }), {
      node: null,
    });
    assert.deepEqual(
      await run('query($id: ID!) { node(id: $id) { ... on Post { title } } }', 2, { id }),
      { node: { title: 'Saving rainwater' } },
    );
    await checkMediaConnections(schema);
    const first = await run(
      '{ posts(first: 2) { totalCount pageInfo { endCursor hasNextPage } nodes { title } } }',
    );
    assert.equal(first.posts.totalCount, 3);
    assert.equal(first.posts.pageInfo.hasNextPage, true);
    const next = await run(
      'query($after: String!) { posts(first: 2, after: $after) { pageInfo { hasNextPage } nodes { title } } }',
      1,
      { after: first.posts.pageInfo.endCursor },
    );
    assert.deepEqual(next.posts.nodes, [{ title: 'Watering through summer' }]);
    assert.equal(next.posts.pageInfo.hasNextPage, false);
    assert.deepEqual(
      await run('{ searchPosts(where: { title: { contains: "compost" } }) { title } }'),
      { searchPosts: [{ title: 'A guide to composting' }] },
    );
    assert.deepEqual(
      await run('{ searchPosts(where: { title: { contains: "spring" } }) { title } }'),
      { searchPosts: [] },
    );
    for (const operation of await readdir(new URL('./operations/', import.meta.url))) {
      if (operation.endsWith('.graphql')) {
        await run(await readFile(new URL(`./operations/${operation}`, import.meta.url), 'utf8'));
      }
    }
    const backward = await run(
      'query($before: String!) { posts(last: 1, before: $before) { nodes { title } } }',
      1,
      { before: first.posts.pageInfo.endCursor },
    );
    assert.deepEqual(backward.posts.nodes, [{ title: 'Starting a seed library' }]);
    const before = await prisma.post.count();
    const created = await run(
      'mutation { createDraft(input: { title: "Mulching paths", content: "Use local wood chips." }) { title published author { name } } }',
    );
    assert.equal(created.createDraft.published, false);
    assert.equal(created.createDraft.author.name, 'Maya Chen');
    assert.equal(await prisma.post.count(), before + 1);
    const denied = await graphql({
      schema,
      source: 'mutation { updateDraft(id: 5, input: { title: "Taken over" }) { title } }',
      contextValue: { userId: 1 },
    });
    assert.ok(denied.errors?.length);
    assert.equal(
      (await prisma.post.findUniqueOrThrow({ where: { id: 5 } })).title,
      'Saving rainwater',
    );
    assert.deepEqual(
      await run(
        'mutation { updateDraft(id: 4, input: { title: "Spring seed exchange" }) { title } }',
      ),
      { updateDraft: { title: 'Spring seed exchange' } },
    );
    const payload = await run(
      'mutation { createDraftWithPayload(title: "Growing herbs", content: "Start with mint.") { post { title author { name } } } }',
    );
    assert.equal(payload.createDraftWithPayload.post.author.name, 'Maya Chen');
    console.log(
      'PASS Prisma publishing: selections, aliases, media, viewers, nodes, pages, filters, writes and denied writes',
    );
  } finally {
    await close();
  }
}
check().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
