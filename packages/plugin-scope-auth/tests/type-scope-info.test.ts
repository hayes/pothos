import SchemaBuilder from '@pothos/core';
import { type GraphQLObjectType, type GraphQLSchema, graphql } from 'graphql';
import { describe, expect, it } from 'vitest';
import { getDatamodel } from '../prisma/generated';
import ScopeAuthPlugin, { type TypeScopeInfo } from '../src';
import { db } from './example/db';

interface Row {
  id: string;
  kind: 'Article' | 'Comment';
}

interface Context {
  user: string | null;
  calls: string[];
}

function createSchema({ runScopesOnType = false } = {}) {
  const builder = new SchemaBuilder<{
    Context: Context;
    AuthScopes: { loggedIn: boolean; admin: boolean };
  }>({
    plugins: [ScopeAuthPlugin],
    prisma: { client: db, dmmf: getDatamodel() },
    scopeAuth: {
      runScopesOnType,
      authScopes: (context) => ({
        loggedIn: !!context.user,
        admin: context.user === 'admin',
      }),
    },
  });

  const infos: TypeScopeInfo[] = [];

  const Node = builder.interfaceRef<Row>('Node').implement({
    resolveType: (row) => row.kind,
    authScopes: (row, context, info) => {
      infos.push(info);
      context.calls.push(`Node.authScopes ${info.parentType.name} ${row.id}`);

      return info.parentType.name === 'Article' ? { loggedIn: true } : { admin: true };
    },
    grantScopes: (row, context, info) => {
      context.calls.push(`Node.grantScopes ${info.parentType.name} ${row.id}`);

      return info.parentType.name === 'Article' ? ['readNotes'] : [];
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      notes: t.string({ authScopes: { $granted: 'readNotes' }, resolve: () => 'notes' }),
    }),
  });

  const Article = builder.objectRef<Row>('Article').implement({
    interfaces: [Node],
    authScopes: (row, context, info) => {
      context.calls.push(`Article.authScopes ${info.parentType.name} ${row.id}`);

      return true;
    },
    fields: (t) => ({ title: t.string({ resolve: () => 'title' }) }),
  });

  const Comment = builder.objectRef<Row>('Comment').implement({
    interfaces: [Node],
    fields: (t) => ({ body: t.string({ resolve: () => 'body' }) }),
  });

  const rows: Record<string, Row> = {
    a1: { id: 'a1', kind: 'Article' },
    c1: { id: 'c1', kind: 'Comment' },
  };

  builder.queryType({
    fields: (t) => ({
      node: t.field({
        type: Node,
        nullable: true,
        args: { id: t.arg.id({ required: true }) },
        resolve: (_root, { id }) => rows[id],
      }),
      sameRowTwice: t.field({
        type: [Node],
        resolve: () => [rows.a1, rows.a1],
      }),
    }),
  });

  // One row object returned as both object types.
  const shared: Row = { id: 's1', kind: 'Article' };

  builder.queryFields((t) => ({
    sharedArticle: t.field({ type: Article, nullable: true, resolve: () => shared }),
    sharedComment: t.field({ type: Comment, nullable: true, resolve: () => shared }),
  }));

  return { schema: builder.toSchema(), infos };
}

function run(schema: GraphQLSchema, source: string, user: string | null) {
  const contextValue: Context = { user, calls: [] };

  return graphql({ schema, source, contextValue }).then((result) => ({
    result,
    calls: contextValue.calls,
  }));
}

describe.each([false, true])('type scope info (runScopesOnType: %s)', (runScopesOnType) => {
  it('passes the concrete object type to interface scopes', async () => {
    const { schema, infos } = createSchema({ runScopesOnType });

    const { result, calls } = await run(
      schema,
      `{
        article: node(id: "a1") { id ... on Article { title } }
        comment: node(id: "c1") { id ... on Comment { body } }
      }`,
      'reader',
    );

    // Field checks null the denied fields; type checks null the object.
    expect(result.data).toEqual({
      article: { id: 'a1', title: 'title' },
      comment: runScopesOnType ? null : { id: null, body: null },
    });
    expect(result.errors?.length).toBeGreaterThan(0);
    expect(calls).toContain('Node.authScopes Article a1');
    expect(calls).toContain('Node.authScopes Comment c1');
    expect(calls).toContain('Article.authScopes Article a1');

    for (const info of infos) {
      expect(info.schema).toBe(schema);
      expect(info.parentType).toBe(schema.getType(info.parentType.name) as GraphQLObjectType);
    }
  });

  it('lets an admin read both types', async () => {
    const { schema } = createSchema({ runScopesOnType });

    const { result } = await run(
      schema,
      `{
        article: node(id: "a1") { id }
        comment: node(id: "c1") { id }
      }`,
      'admin',
    );

    expect(result).toEqual({ data: { article: { id: 'a1' }, comment: { id: 'c1' } } });
  });
});

describe('type scope info', () => {
  it('caches interface scope results separately for each object type', async () => {
    const { schema } = createSchema();

    const { result, calls } = await run(
      schema,
      `{
        sharedArticle { id }
        sharedComment { id }
      }`,
      'reader',
    );

    expect(result.data).toEqual({ sharedArticle: { id: 's1' }, sharedComment: { id: null } });
    expect(calls.filter((call) => call.startsWith('Node.authScopes'))).toEqual([
      'Node.authScopes Article s1',
      'Node.authScopes Comment s1',
    ]);
  });

  it('still caches the result for a single object type', async () => {
    const { schema } = createSchema();

    const { calls } = await run(
      schema,
      `{
        sameRowTwice { id ... on Article { title } }
      }`,
      'reader',
    );

    expect(calls.filter((call) => call.startsWith('Node.authScopes'))).toEqual([
      'Node.authScopes Article a1',
    ]);
  });

  it('passes the concrete object type to interface grantScopes', async () => {
    const { schema } = createSchema();

    const { result, calls } = await run(
      schema,
      `{
        article: node(id: "a1") { notes }
        comment: node(id: "c1") { notes }
      }`,
      'admin',
    );

    expect(result.data).toEqual({ article: { notes: 'notes' }, comment: { notes: null } });
    expect(calls).toContain('Node.grantScopes Article a1');
    expect(calls).toContain('Node.grantScopes Comment c1');
  });
});
