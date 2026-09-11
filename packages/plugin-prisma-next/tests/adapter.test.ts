/**
 * The walk, pinned through a recording collection: what `applySelectionToCollection` emits for
 * a selection on a real builder schema over the sample contract. Each case renders the recorded
 * chain (`select(...)`, `include(rel){ ... }`, `combine(slot=[...])`) and compares it.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute } from '@pothos/test-utils';
import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  type GraphQLResolveInfo,
  parse,
} from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin, { applySelectionToCollection, type MapperCollection } from '../src';
import type { SampleContract } from './fixtures/runtime';

const sampleContract = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/sample-contract.json', import.meta.url)), 'utf8'),
) as SampleContract;

// ---------------------------------------------------------------------------------------------
// A recording collection: immutable like the real builder, so two branches of one combine are
// two distinct chains.
// ---------------------------------------------------------------------------------------------

interface RecordedCall {
  method: string;
  args?: unknown[];
  inner?: RecordedCall[];
  slots?: Record<string, unknown>;
}

class RecordingCollection implements MapperCollection {
  constructor(readonly calls: RecordedCall[] = []) {}

  private chain(method: string, ...args: unknown[]) {
    return new RecordingCollection([...this.calls, { method, args }]);
  }

  private reduce(reduce: string) {
    return { reduce, calls: this.calls };
  }

  select(...fields: string[]) {
    return this.chain('select', ...fields);
  }

  include(name: string, refine?: (rel: MapperCollection) => MapperCollection) {
    const inner = refine ? (refine(new RecordingCollection()) as RecordingCollection).calls : [];

    return new RecordingCollection([...this.calls, { method: 'include', args: [name], inner }]);
  }

  combine(spec: Record<string, unknown>) {
    const slots: Record<string, unknown> = {};

    for (const key of Object.keys(spec)) {
      const value = spec[key];

      slots[key] = value instanceof RecordingCollection ? value.calls : value;
    }

    return new RecordingCollection([...this.calls, { method: 'combine', slots }]);
  }

  count() {
    return this.reduce('count');
  }

  sum(field: string) {
    return this.reduce(`sum(${field})`);
  }

  avg(field: string) {
    return this.reduce(`avg(${field})`);
  }

  min(field: string) {
    return this.reduce(`min(${field})`);
  }

  max(field: string) {
    return this.reduce(`max(${field})`);
  }

  where(input: unknown) {
    return this.chain('where', input);
  }

  orderBy(input: unknown) {
    return this.chain('orderBy', input);
  }

  cursor(values: Record<string, unknown>) {
    return this.chain('cursor', values);
  }

  take(n: number) {
    return this.chain('take', n);
  }

  skip(n: number) {
    return this.chain('skip', n);
  }
}

function render(collection: MapperCollection): string[] {
  return (collection as RecordingCollection).calls.map(renderCall);
}

function renderCalls(calls: RecordedCall[]): string {
  return calls.map(renderCall).join(' ');
}

function renderCall(call: RecordedCall): string {
  switch (call.method) {
    case 'select':
      return `select(${[...(call.args as string[])].sort().join(', ')})`;
    case 'include':
      return call.inner!.length > 0
        ? `include(${call.args![0]}){ ${renderCalls(call.inner!)} }`
        : `include(${call.args![0]})`;
    case 'combine':
      return `combine(${Object.keys(call.slots!)
        .sort()
        .map((key) => `${key}=${renderSlot(call.slots![key])}`)
        .join(', ')})`;
    default:
      return `${call.method}(${call.args!.map(show).join(', ')})`;
  }
}

function renderSlot(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${renderCalls(value as RecordedCall[])}]`;
  }

  if (value && typeof value === 'object' && 'reduce' in value) {
    const { reduce, calls } = value as { reduce: string; calls: RecordedCall[] };

    return `${reduce}[${renderCalls(calls)}]`;
  }

  return show(value);
}

function show(value: unknown): string {
  return typeof value === 'function' ? 'fn' : JSON.stringify(value);
}

// ---------------------------------------------------------------------------------------------
// Schema.
// ---------------------------------------------------------------------------------------------

const captured: { args: unknown; ctx: unknown }[] = [];

function createSchema({ asyncSelect = false } = {}) {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
    Context: { tenantId?: string };
  }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: sampleContract as never },
  });

  const Comment = builder.prismaObject('Comment', {
    // A type-level select in the column-array form.
    select: ['id'],
    fields: (t) => ({
      body: t.exposeString('body'),
      author: t.relation('author'),
    }),
  });

  const Post = builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id'),
      title: t.exposeString('title'),
      asyncTitle: t.string({
        select: (async () => ['title']) as never,
        resolve: () => 'async title',
      }),
      // GraphQL field name `isPublished`, backing column `published` (an int in sqlite).
      isPublished: t.exposeInt('published'),
      author: t.relation('author'),
      comments: t.relation('comments'),
    }),
  });

  const AdminUser = builder.prismaObject('User', {
    variant: 'AdminUser',
    // A type-level select in the object form: a column and a count on a relation.
    select: {
      email: true,
      posts: (sub: MapperCollection) => ({ total: sub.count() }),
    },
    fields: (t) => ({
      id: t.exposeID('id'),
      lastName: t.exposeString('lastName'),
      asyncLastName: t.string({
        select: (async () => ['lastName']) as never,
        resolve: () => 'async last name',
      }),
      posts: t.relation('posts'),
    }),
  });

  const User = builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id'),
      firstName: t.exposeString('firstName'),
      lastName: t.exposeString('lastName'),
      // Multi-column dependency of a computed resolver.
      fullName: t.string({
        select: ['firstName', 'lastName'],
        resolve: (user) => `${user.firstName} ${user.lastName}`,
      }),
      // No exposed column, no select — pure compute.
      plugin: t.string({ resolve: () => 'prisma-next' }),
      posts: t.relation('posts'),
      postsConnection: t.relatedConnection('posts', {
        cursor: 'id',
        defaultSize: 2,
        totalCount: true,
      }),
      // Sibling aliases of the same relation with declarative refines.
      drafts: t.relation('posts', { query: { where: { published: 0 } } }),
      publishedPosts: t.relation('posts', { query: { where: { published: 1 } } }),
      // An args-dependent query: resolved once per field occurrence, with the request context.
      filteredPosts: t.relation('posts', {
        args: { published: t.arg.int(), take: t.arg.int() },
        query: (args, ctx) => {
          captured.push({ args, ctx });

          return {
            where: args.published == null ? undefined : { published: args.published },
            take: args.take ?? undefined,
          } as never;
        },
      }),
      postCount: t.relationCount('posts'),
      // A function-form select returning several slots, as a connection does.
      postsPage: t.field({
        type: [Post],
        select: asyncSelect
          ? ((async () => ({
              posts: (sub: MapperCollection) => ({ rows: sub.take(3), count: sub.count() }),
            })) as never)
          : ({
              posts: (sub: MapperCollection) => ({ rows: sub.take(3), count: sub.count() }),
            } as never),
        resolve: (user) => (user as { rows: never[] }).rows,
      }),
      // A same-row variant with forced column reads.
      asAdmin: t.variant(AdminUser, { select: ['firstName'] }),
      // A relation entry on a scalar-returning field: included, nothing walked beneath.
      commentCount: t.int({
        select: { comments: true } as never,
        resolve: (user) => (user as { comments: unknown[] }).comments.length,
      }),
    }),
  });

  let info: GraphQLResolveInfo | undefined;

  builder.queryType({
    fields: (t) => ({
      users: t.field({
        type: [User],
        resolve: (_root, _args, _ctx, resolveInfo) => {
          info = resolveInfo;

          return [];
        },
      }),
      comments: t.field({
        type: [Comment],
        resolve: (_root, _args, _ctx, resolveInfo) => {
          info = resolveInfo;

          return [];
        },
      }),
      admins: t.field({
        type: [AdminUser],
        resolve: (_root, _args, _ctx, resolveInfo) => {
          info = resolveInfo;

          return [];
        },
      }),
    }),
  });

  const schema = builder.toSchema();

  return {
    schema,
    async infoFor(source: string, variableValues?: Record<string, unknown>) {
      info = undefined;

      const result = await execute({
        schema,
        document: parse(source),
        contextValue: { tenantId: 'tenant-42' },
        variableValues,
      });

      if (result.errors) {
        throw result.errors[0];
      }

      return info!;
    },
  };
}

const { infoFor } = createSchema();

async function plan(
  source: string,
  options: Parameters<typeof applySelectionToCollection>[4] & {
    variableValues?: Record<string, unknown>;
    context?: object;
  } = {},
) {
  const { variableValues, context, ...rest } = options;
  const info = await infoFor(source, variableValues);

  return render(
    await applySelectionToCollection(
      new RecordingCollection(),
      info,
      sampleContract as never,
      context ?? {},
      rest,
    ),
  );
}

// ---------------------------------------------------------------------------------------------
// Cases.
// ---------------------------------------------------------------------------------------------

describe('columns', () => {
  it('emits .select(...) for queried scalar fields only', async () => {
    expect(await plan('{ users { id firstName } }')).toEqual(['select(firstName, id)']);
  });

  it('selects the column name passed to exposeX, decoupled from the GraphQL field name', async () => {
    expect(await plan('{ users { posts { isPublished } } }')).toEqual([
      'select(id)',
      'include(posts){ select(published) }',
    ]);
  });

  it('honours `t.field({ select: [...] })` for a computed resolver that needs columns', async () => {
    expect(await plan('{ users { fullName } }')).toEqual(['select(firstName, lastName)']);
  });

  it('skips fields with no exposed column and no select dependency', async () => {
    expect(await plan('{ users { id plugin } }')).toEqual(['select(id)']);
  });

  it('drops fields with @skip(if: true) / @include(if: false) and keeps the inactive forms', async () => {
    expect(
      await plan('{ users { id firstName @skip(if: true) lastName @include(if: false) } }'),
    ).toEqual(['select(id)']);
    expect(
      await plan('{ users { id firstName @skip(if: false) lastName @include(if: true) } }'),
    ).toEqual(['select(firstName, id, lastName)']);
  });

  it('honours @skip / @include on fragments', async () => {
    expect(
      await plan(
        /* GraphQL */ `
        query ($skip: Boolean!) { users { id ... on User @skip(if: $skip) { firstName } ...F @include(if: false) } }
        fragment F on User { lastName }
      `,
        { variableValues: { skip: true } },
      ),
    ).toEqual(['select(id)']);
  });
});

describe('relations', () => {
  it('emits a plain .include(rel, refineFn) for a single-field relation', async () => {
    expect(await plan('{ users { id posts { id title } } }')).toEqual([
      'select(id)',
      'include(posts){ select(id, title) }',
    ]);
  });

  it('augments the parent .select(...) with the relation localFields', async () => {
    // `id` is the parent-side join column for `posts`; `authorId` for `author`.
    expect(await plan('{ users { firstName posts { author { firstName } } } }')).toEqual([
      'select(firstName, id)',
      'include(posts){ select(authorId) include(author){ select(firstName) } }',
    ]);
  });

  it('recurses into nested relations (depth >= 2), entering each level type select', async () => {
    expect(await plan('{ users { posts { title comments { body author { id } } } } }')).toEqual([
      'select(id)',
      'include(posts){ select(id, title) include(comments){ select(authorId, body, id) include(author){ select(id) } } }',
    ]);
  });

  it('collapses sibling aliases on the same relation into one .include + .combine', async () => {
    expect(await plan('{ users { drafts { id } publishedPosts { title } } }')).toEqual([
      'select(id)',
      'include(posts){ combine(drafts:posts=[where({"published":0}) select(id)], publishedPosts:posts=[where({"published":1}) select(title)]) }',
    ]);
  });

  it('applies a declarative refine on the single-consumer fast path (no combine)', async () => {
    expect(await plan('{ users { drafts { id } } }')).toEqual([
      'select(id)',
      'include(posts){ where({"published":0}) select(id) }',
    ]);
  });

  it('passes resolved field args and the request ctx to a callback query', async () => {
    captured.length = 0;

    expect(
      await plan('{ users { filteredPosts(published: 1, take: 2) { id } } }', {
        context: { tenantId: 'tenant-42' },
      }),
    ).toEqual(['select(id)', 'include(posts){ where({"published":1}) take(2) select(id) }']);
    expect(captured).toHaveLength(1);
    expect(captured[0].args).toEqual({ published: 1, take: 2 });
    expect(captured[0].ctx).toEqual({ tenantId: 'tenant-42' });
  });

  it('shares one include for compatible to-one aliases', async () => {
    expect(await plan('{ users { posts { a: author { id } b: author { firstName } } } }')).toEqual([
      'select(id)',
      'include(posts){ select(authorId) include(author){ select(firstName, id) } }',
    ]);
  });

  it('unions one relation selected under two fragments into one slot', async () => {
    expect(
      await plan(/* GraphQL */ `
        { users { ...A ...B } }
        fragment A on User { posts { id } }
        fragment B on User { posts { title } }
      `),
    ).toEqual(['select(id)', 'include(posts){ select(id, title) }']);
  });

  it('descends through named fragments across multiple levels', async () => {
    expect(
      await plan(/* GraphQL */ `
        { users { ...UserA } }
        fragment UserA on User { id ...UserB }
        fragment UserB on User { firstName ...UserC }
        fragment UserC on User { lastName posts { id title } }
      `),
    ).toEqual(['select(firstName, id, lastName)', 'include(posts){ select(id, title) }']);
  });

  it('includes a relation entry on a scalar field without walking beneath it', async () => {
    expect(await plan('{ users { commentCount } }')).toEqual(['select(id)', 'include(comments)']);
  });
});

describe('counts and function-form entries', () => {
  it('puts a function-form count beside a sibling branch in the same combine', async () => {
    expect(await plan('{ users { drafts { id } postCount } }')).toEqual([
      'select(id)',
      'include(posts){ combine(drafts:posts=[where({"published":0}) select(id)], postCount:posts=count[]) }',
    ]);
  });

  it('emits combine when a count is queried alone', async () => {
    expect(await plan('{ users { postCount } }')).toEqual([
      'select(id)',
      'include(posts){ combine(postCount:posts=count[]) }',
    ]);
  });

  it('namespaces every key a function-form entry returns under <alias>:', async () => {
    expect(await plan('{ users { page: postsPage { id } } }')).toEqual([
      'select(id)',
      'include(posts){ combine(page:count=count[], page:rows=[take(3)]) }',
    ]);
  });

  it('throws a clear error for a select key that is neither column nor relation', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { contract: sampleContract as never },
    });
    let info: GraphQLResolveInfo | undefined;
    const User = builder.prismaObject('User', {
      fields: (t) => ({
        garbled: t.string({ select: { firstNme: true } as never, resolve: () => 'x' }),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        users: t.field({
          type: [User],
          resolve: (_r, _a, _c, i) => {
            info = i;
            return [];
          },
        }),
      }),
    });
    const schema = builder.toSchema();

    await execute({ schema, document: parse('{ users { garbled } }'), contextValue: {} });
    expect(() =>
      applySelectionToCollection(new RecordingCollection(), info!, sampleContract as never, {}),
    ).toThrow("select: 'firstNme' is not a column or relation on User");
  });
});

describe('type-level selects and variants', () => {
  it('applies a type-level column select on every level it enters', async () => {
    expect(await plan('{ comments { body } }')).toEqual(['select(body, id)']);
  });

  it('slots a type-level relation entry under :object:<Type>', async () => {
    expect(await plan('{ admins { lastName } }')).toEqual([
      'select(email, id, lastName)',
      'include(posts){ combine(:object:AdminUser:total=count[]) }',
    ]);
  });

  it('walks a t.variant on the same row with its forced columns and the variant type select', async () => {
    expect(await plan('{ users { id asAdmin { lastName posts { title } } } }')).toEqual([
      'select(email, firstName, id, lastName)',
      'include(posts){ combine(asAdmin::object:AdminUser:total=count[], asAdmin:posts:posts=[select(title)]) }',
    ]);
  });

  it('walks `... on Node`-style interface fragments under an object type', async () => {
    // No Node interface in this schema; an untyped inline fragment stands in for the rule that
    // a fragment applicable to the walked type is entered.
    expect(await plan('{ users { ... { id } ... on User { firstName } } }')).toEqual([
      'select(firstName, id)',
    ]);
  });
});

describe('entry options', () => {
  it('walks as `typeName` instead of the return type (node batching)', async () => {
    expect(
      await plan('{ users { id ... on User { firstName } } }', {
        typeName: 'AdminUser',
        extraColumns: ['id'],
      }),
    ).toEqual(['select(email, id)', 'include(posts){ combine(:object:AdminUser:total=count[]) }']);
  });

  it('reads extraColumns ahead of the selection', async () => {
    expect(await plan('{ users { firstName } }', { extraColumns: ['id', 'email'] })).toEqual([
      'select(email, firstName, id)',
    ]);
  });

  it('descends through `paths` and keeps only extraColumns when nothing is under them', async () => {
    expect(await plan('{ users { id } }', { paths: [['missing']], extraColumns: ['id'] })).toEqual([
      'select(id)',
    ]);
  });

  it('honours skipDeferredFragments', async () => {
    const source = '{ users { id ... @defer { lastName } } }';
    const { infoFor: deferInfo } = createDeferSchema();
    const info = await deferInfo(source);

    expect(
      render(
        applySelectionToCollection(new RecordingCollection(), info, sampleContract as never, {}),
      ),
    ).toEqual(['select(id)']);
    expect(
      render(
        applySelectionToCollection(
          new RecordingCollection(),
          info,
          sampleContract as never,
          {},
          {
            skipDeferredFragments: false,
          },
        ),
      ),
    ).toEqual(['select(id, lastName)']);
  });

  it.each([
    ['{ users { posts { asyncTitle } } }', ['select(id)', 'include(posts){ select(title) }']],
    [
      '{ users { drafts { asyncTitle } } }',
      ['select(id)', 'include(posts){ where({"published":0}) select(title) }'],
    ],
    [
      '{ users { asAdmin { asyncLastName } } }',
      [
        'select(email, firstName, id, lastName)',
        'include(posts){ combine(asAdmin::object:AdminUser:total=count[]) }',
      ],
    ],
    [
      '{ users { asAdmin { posts { asyncTitle } } } }',
      [
        'select(email, firstName, id)',
        'include(posts){ combine(asAdmin::object:AdminUser:total=count[], asAdmin:posts:posts=[select(title)]) }',
      ],
    ],
    [
      '{ users { postsConnection { totalCount edges { node { asyncTitle } } } } }',
      [
        'select(id)',
        'include(posts){ combine(postsConnection:count=count[], postsConnection:rows=[orderBy(fn) take(3) select(id, title)]) }',
      ],
    ],
  ])('awaits nested async selections in %s', async (source, expected) => {
    expect(await plan(source)).toEqual(expected);
  });

  it('awaits an async select callback', async () => {
    const { infoFor: asyncInfo } = createSchema({ asyncSelect: true });
    const info = await asyncInfo('{ users { postsPage { id } } }');
    const applied = applySelectionToCollection(
      new RecordingCollection(),
      info,
      sampleContract as never,
      {},
    );

    expect(applied).toBeInstanceOf(Promise);
    expect(render(await applied)).toEqual([
      'select(id)',
      'include(posts){ combine(postsPage:count=count[], postsPage:rows=[take(3)]) }',
    ]);
  });
});

/** The schema with a `@defer` directive declared, so deferred fragments can be written. */
function createDeferSchema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: sampleContract as never },
  });
  let info: GraphQLResolveInfo | undefined;
  const User = builder.prismaObject('User', {
    fields: (t) => ({ id: t.exposeID('id'), lastName: t.exposeString('lastName') }),
  });
  builder.queryType({
    fields: (t) => ({
      users: t.field({
        type: [User],
        resolve: (_r, _a, _c, i) => {
          info = i;
          return [];
        },
      }),
    }),
  });
  const schema = builder.toSchema({
    directives: [
      new GraphQLDirective({
        name: 'defer',
        locations: [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
        args: { if: { type: GraphQLBoolean } },
      }),
    ],
  });

  return {
    async infoFor(source: string) {
      const result = await execute({ schema, document: parse(source), contextValue: {} });

      if (result.errors) {
        throw result.errors[0];
      }

      return info!;
    },
  };
}

describe('execution context', () => {
  it.each([
    undefined,
    null,
    'tenant-42',
    42,
  ])('preserves context %s and synchronous selection in the direct helper', async (context) => {
    captured.length = 0;
    const info = await infoFor('{ users { filteredPosts(published: 1) { id } } }');
    const result = applySelectionToCollection(
      new RecordingCollection(),
      info,
      sampleContract as never,
      context,
    );

    expect(result).not.toBeInstanceOf(Promise);
    expect(render(result)).toEqual([
      'select(id)',
      'include(posts){ where({"published":1}) select(id) }',
    ]);
    expect(captured).toEqual([{ args: { published: 1 }, ctx: context }]);
  });

  it('executes a prismaField without contextValue', async () => {
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });
    const User = builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id') }),
    });
    const collection = {
      select() {
        return this;
      },
      include() {
        return this;
      },
      where() {
        return this;
      },
      all: async () => [{ id: 'u1' }],
    };
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: [User], resolve: () => collection as never }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: parse('{ users { id } }'),
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: [{ id: 'u1' }] });
  });
});
