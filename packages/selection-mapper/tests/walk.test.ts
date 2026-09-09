import { describe, expect, it } from 'vitest';
import {
  getLoaderMapping,
  queryFromInfo,
  queryFromWalk,
  selectedFieldNames,
  selectionStateFromInfo,
  walkFromInfo,
} from '../src';
import { resolveInfo } from './fake-adapter';
import { createTestAdapter, createTestSchema } from './schema';

const schema = createTestSchema();
const adapter = createTestAdapter();

function pathOf(...keys: (string | number)[]) {
  let path: { prev: unknown; key: string | number; typename: undefined } | undefined;

  for (const key of keys) {
    path = { prev: path, key, typename: undefined };
  }

  return path as never;
}

describe('queryFromInfo', () => {
  it('walks the resolved field into one query and records mappings under its path', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      '{ user { id posts(take: 2) { id author(x: 1) { name } } profile { bio } } }',
    );

    const query = queryFromInfo(adapter, { context, info });

    // User is include mode: entering it selects every column, relations nest beneath.
    expect(query).toEqual({
      select: { posts: { take: 2, select: { author: { where: { x: 1 } } } }, profile: true },
    });

    const posts = getLoaderMapping(context, pathOf('user', 'posts'), 'User');

    expect(posts?.nested).toEqual({ 'Post@author': { nested: {} } });
    expect(getLoaderMapping(context, pathOf('user', 'profile'), 'User')?.nested).toEqual({});
    // Only the walked field's own mappings are recorded; deeper ones wait for their resolver.
    expect(getLoaderMapping(context, pathOf('user', 'posts', 0, 'author'), 'Post')).toBe(null);
  });

  it('merges an initial selection first and keeps the caller in named-column mode', async () => {
    const info = await resolveInfo(schema, '{ viewer { email } }');

    expect(
      queryFromInfo(adapter, { context: {}, info, initial: { select: { name: true } } }),
    ).toEqual({
      select: { posts: { take: 5 }, name: true, id: true, email: true },
    });
  });

  it('keys mappings by the full relative path, so both connection paths are recorded (L-1)', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        user {
          postsConnection(first: 2) {
            totalCount
            nodes { id author(x: 1) { name } }
            edges { node { title comments { id } } }
          }
        }
      }`,
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({
      extras: { postsCount: true },
      select: { posts: { take: 2, select: { author: { where: { x: 1 } }, comments: true } } },
    });

    const mapping = getLoaderMapping(context, pathOf('user', 'postsConnection'), 'User');

    expect(Object.keys(mapping!.nested)).toEqual(['Post@nodes.author', 'Post@edges.node.comments']);
  });

  it('leaves a child root un-entered when no path matches (E-3)', async () => {
    const info = await resolveInfo(
      schema,
      '{ user { postsConnection(first: 2) { pageInfo { hasNextPage } } } }',
    );

    expect(queryFromInfo(adapter, { context: {}, info })).toEqual({
      select: { posts: { take: 2, select: {} } },
    });
  });

  it('records a mapping only when the field is accepted, so a conflict loads separately (M-4)', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        user {
          ... on User { posts { a1: author(x: 1) { name } } }
          ... on User { posts { a2: author(x: 2) { name } } }
        }
      }`,
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({
      select: { posts: { select: { author: { where: { x: 1 } } } } },
    });
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')?.nested).toEqual({
      'Post@a1': { nested: {} },
    });
  });

  it('unions the mappings of a field accepted under two fragments', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        user {
          ... on User { posts { author { name } } }
          ... on User { posts { comments { id } } }
        }
      }`,
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({
      select: { posts: { select: { author: true, comments: true } } },
    });
    expect(Object.keys(getLoaderMapping(context, pathOf('user', 'posts'), 'User')!.nested)).toEqual(
      ['Post@author', 'Post@comments'],
    );
  });

  it('neither merges nor maps a field whose select returns nothing (S-5)', async () => {
    const context = {};
    const info = await resolveInfo(schema, '{ user { posts { id } } }');
    const nothing = createTestAdapter();

    nothing.fieldSelection = () => () => null;

    expect(queryFromInfo(nothing, { context, info })).toEqual({});
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
  });

  it('skips fields under @skip and deferred fragments by default (S-2, S-8)', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        user {
          posts @skip(if: true) { id }
          ... @defer { profile { bio } }
        }
      }`,
    );

    expect(queryFromInfo(adapter, { context: {}, info })).toEqual({});
    expect(queryFromInfo(adapter, { context: {}, info, skipDeferredFragments: false })).toEqual({
      select: { profile: true },
    });
  });

  it('returns the initial selection when paths match nothing (E-1)', async () => {
    const context = {};
    const info = await resolveInfo(schema, '{ entries { kind } }');

    expect(
      queryFromInfo(adapter, { context, info, typeName: 'User', path: ['appointment'] }),
    ).toEqual({});
    expect(
      queryFromInfo(adapter, {
        context,
        info,
        typeName: 'User',
        paths: [['appointment']],
        initial: { select: { id: true } },
      }),
    ).toEqual({ select: { id: true } });

    // The initial selection comes back as the caller's own object: nothing was planned into it.
    const initial = { select: { id: true, name: true } };

    expect(
      queryFromInfo(adapter, {
        context,
        info,
        typeName: 'User',
        paths: [['appointment']],
        initial,
      }),
    ).toBe(initial);
  });

  it('walks every path match as its own type into one query (W-11)', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        entries {
          ... on AppointmentEntry { appointment { id posts(take: 5) { id } } }
          ... on VariantEntry { appointment { id email profile { bio } } }
          ... on OtherEntry { appointment { title } }
        }
      }`,
    );

    // Viewer's type-level `posts: { take: 5 }` merges into the node the User walk created.
    expect(
      queryFromInfo(adapter, { context, info, typeName: 'User', path: ['appointment'] }),
    ).toEqual({ select: { posts: { take: 5 }, profile: true } });
    expect(getLoaderMapping(context, pathOf('entries', 3, 'appointment', 'posts'), 'User')).toEqual(
      {
        nested: {},
      },
    );
    expect(
      getLoaderMapping(context, pathOf('entries', 'appointment', 'profile'), 'Viewer'),
    ).toEqual({
      nested: {},
    });
  });

  it('enters every path match before merging any field, whichever match comes first (W-11)', async () => {
    const appointmentFirst = /* GraphQL */ `{
      entries {
        ... on AppointmentEntry { appointment { posts(take: 2) { id } } }
        ... on VariantEntry { appointment { id } }
      }
    }`;
    const variantFirst = /* GraphQL */ `{
      entries {
        ... on VariantEntry { appointment { id } }
        ... on AppointmentEntry { appointment { posts(take: 2) { id } } }
      }
    }`;

    for (const source of [appointmentFirst, variantFirst]) {
      const context = {};
      const info = await resolveInfo(schema, source);

      // Viewer's type-level `posts: { take: 5 }` is settled before the User match's field is
      // merged, so `posts(take: 2)` is a field-level conflict in both orders: it is not mapped
      // and its resolver loads its own two rows instead of reading the five planned here.
      expect(
        queryFromInfo(adapter, { context, info, typeName: 'User', path: ['appointment'] }),
      ).toEqual({ select: { posts: { take: 5 } } });
      expect(getLoaderMapping(context, pathOf('entries', 0, 'appointment', 'posts'), 'User')).toBe(
        null,
      );
    }
  });

  it('plans through a wrapper with a type-level path (E-4, E-5)', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      '{ result { ... on UserSuccess { data { posts { id } } } ... on Failure { message } } }',
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({ select: { posts: true } });
    expect(getLoaderMapping(context, pathOf('result', 'data', 'posts'), 'User')).toEqual({
      nested: {},
    });
  });

  it('hands the adapter extra of the enclosing field to every select function (D-7)', async () => {
    const context = {};
    const withExtra = createTestAdapter({ withExtra: true });
    const seen: unknown[] = [];
    const { fieldSelection } = withExtra;

    withExtra.fieldSelection = (field, type) => {
      const selection = fieldSelection(field, type);

      return typeof selection === 'function'
        ? (...args) => {
            seen.push([field.name, args[4]]);

            return selection(...args);
          }
        : selection;
    };

    const info = await resolveInfo(schema, '{ user { posts { author { name } } } }');

    queryFromInfo(withExtra, { context, info });

    expect(seen).toEqual([
      ['posts', ['Query.user', 'User.posts']],
      ['author', ['Query.user', 'User.posts', 'Post.author']],
    ]);
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')?.extra).toEqual([
      'Query.user',
      'User.posts',
    ]);
  });

  it('rejects a promise handed to a relation (A-6)', async () => {
    const info = await resolveInfo(schema, '{ user { posts { id } } }');
    const async = createTestAdapter();

    async.fieldSelection = () => () => ({ select: { posts: Promise.resolve({}) as never } });

    expect(() => queryFromInfo(async, { context: {}, info })).toThrow(
      'Relation "posts" was given a promise',
    );
  });
});

describe('fragments (S-7)', () => {
  it("merges a variant's type-level selection when a fragment enters it", async () => {
    const info = await resolveInfo(schema, '{ person { id ... on User { name } } }');

    // Person is select mode; the User fragment flips the query to every column.
    expect(queryFromInfo(adapter, { context: {}, info })).toEqual({});
  });

  it('does not enter an object variant under a concrete field type', async () => {
    const info = await resolveInfo(schema, '{ viewer { id ... on User { name } } }');

    // The field is declared as Viewer, so a User row can never be returned there.
    expect(queryFromInfo(adapter, { context: {}, info })).toEqual({
      select: { posts: { take: 5 }, id: true },
    });
  });

  it('rejects a variant whose type-level relation arguments conflict', async () => {
    const info = await resolveInfo(
      schema,
      '{ person { id ... on Viewer { email } ... on Admin { id } } }',
    );

    expect(() => queryFromInfo(adapter, { context: {}, info })).toThrow(
      'Type-level selections of Person and Admin conflict on relation "posts"',
    );
  });

  it('rejects a variant whose type-level extras conflict', async () => {
    const withExtras = createTestAdapter();
    const { typeSelection } = withExtras;
    const count = () => 1;

    withExtras.typeSelection = (type) => {
      if (type.name === 'Person') {
        return { select: { id: true }, extras: { total: count } };
      }

      if (type.name === 'Viewer') {
        return { select: { id: true }, extras: { total: () => 2 } };
      }

      if (type.name === 'Admin') {
        return { select: { id: true }, extras: { total: count } };
      }

      return typeSelection(type);
    };

    const same = await resolveInfo(schema, '{ person { id ... on Admin { id } } }');

    expect(queryFromInfo(withExtras, { context: {}, info: same })).toEqual({
      extras: { total: count },
      select: { id: true },
    });

    const other = await resolveInfo(schema, '{ person { id ... on Viewer { email } } }');

    expect(() => queryFromInfo(withExtras, { context: {}, info: other })).toThrow(
      'Type-level selections of Person and Viewer conflict on extra "total". Define the extra with the same function on both types, or move it to a field-level select on one of the types.',
    );
  });

  it('enters variants before any field is merged, so conflicts are order-independent', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      '{ person { posts(take: 2) { id } ... on Viewer { email } } }',
    );

    // Viewer's type-level `posts: { take: 5 }` wins; the field's own `take: 2` is a field-level
    // conflict, so `posts` loads on its own instead of raising an error.
    expect(queryFromInfo(adapter, { context, info })).toEqual({
      select: { posts: { take: 5 }, id: true, email: true },
    });
    expect(getLoaderMapping(context, pathOf('person', 'posts'), 'Person')).toBe(null);
  });

  it('walks fields and fragment fields in document order, so the first selection of a relation wins (E-1)', async () => {
    const fragmentFirst = {};
    const info = await resolveInfo(
      schema,
      '{ user { ... on User { first: posts(take: 1) { id } } second: posts(take: 2) { id } } }',
    );

    expect(queryFromInfo(adapter, { context: fragmentFirst, info })).toEqual({
      select: { posts: { take: 1 } },
    });
    expect(getLoaderMapping(fragmentFirst, pathOf('user', 'first'), 'User')).toEqual({
      nested: {},
    });
    expect(getLoaderMapping(fragmentFirst, pathOf('user', 'second'), 'User')).toBe(null);

    const fieldFirst = {};
    const mirror = await resolveInfo(
      schema,
      '{ user { second: posts(take: 2) { id } ... on User { first: posts(take: 1) { id } } } }',
    );

    expect(queryFromInfo(adapter, { context: fieldFirst, info: mirror })).toEqual({
      select: { posts: { take: 2 } },
    });
    expect(getLoaderMapping(fieldFirst, pathOf('user', 'second'), 'User')).toEqual({ nested: {} });
    expect(getLoaderMapping(fieldFirst, pathOf('user', 'first'), 'User')).toBe(null);
  });

  it('honours @skip and @include on fragments', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `
        query ($skip: Boolean!) {
          person {
            ... on Viewer @skip(if: $skip) { email }
            ...Admin @include(if: false)
            ... @include(if: true) { posts { id } }
          }
        }
        fragment Admin on Admin { id }
      `,
      { variableValues: { skip: true } },
    );

    expect(queryFromInfo(adapter, { context: {}, info })).toEqual({
      select: { posts: true, id: true },
    });
  });

  it('suppresses fields of a fragment that cannot apply, but lets a nested one narrow back', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      '{ person { ... on Named { name ... on User { posts { id } } } } }',
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({ select: { posts: true } });
    expect(getLoaderMapping(context, pathOf('person', 'posts'), 'User')).toEqual({ nested: {} });
  });

  it('walks a fragment on an interface the type implements as the type', async () => {
    const context = {};
    const info = await resolveInfo(schema, '{ user { ... on Person { posts(take: 1) { id } } } }');

    expect(queryFromInfo(adapter, { context, info })).toEqual({
      select: { posts: { take: 1 } },
    });
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toEqual({ nested: {} });
  });
});

describe('repeated fragment spreads (W-2)', () => {
  /** F1 spreads F2 twice, F2 spreads F3 twice, and so on; the last fragment selects `leaf`. */
  function fragmentChain(depth: number, leaf: string) {
    const fragments: string[] = [];

    for (let i = 1; i < depth; i += 1) {
      fragments.push(`fragment F${i} on Person { ...F${i + 1} ...F${i + 1} }`);
    }

    fragments.push(`fragment F${depth} on Person { ${leaf} }`);

    return fragments.join('\n');
  }

  it('expands a fragment spread more than once under a type once per pass', async () => {
    const counting = createTestAdapter();
    const calls = { typeSelection: 0, fieldSelection: 0 };
    const { typeSelection, fieldSelection } = counting;

    counting.typeSelection = (type) => {
      if (type.name === 'Viewer') {
        calls.typeSelection += 1;
      }

      return typeSelection(type);
    };
    counting.fieldSelection = (field, type) => {
      if (field.name === 'email') {
        calls.fieldSelection += 1;
      }

      return fieldSelection(field, type);
    };

    const info = await resolveInfo(
      schema,
      `{ person { id ...F1 } }\n${fragmentChain(12, '... on Viewer { email }')}`,
    );
    const started = performance.now();

    expect(queryFromInfo(counting, { context: {}, info })).toEqual({
      select: { posts: { take: 5 }, id: true, email: true },
    });
    expect(performance.now() - started).toBeLessThan(1000);
    // The variant is entered once and its field applied once, not 2^11 times each.
    expect(calls).toEqual({ typeSelection: 1, fieldSelection: 1 });
  });

  it('expands a fragment again when it is reached under another type', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `
        { person { ... on Viewer { ...Posts } ...Posts } }
        fragment Posts on Person { posts(take: 5) { id } }
      `,
    );

    expect(queryFromInfo(adapter, { context, info })).toEqual({
      select: { posts: { take: 5 }, id: true },
    });
    // Under Viewer the field is keyed by the variant, under Person by the interface: the
    // resolver looks its mapping up by the runtime type, so both are needed.
    expect(getLoaderMapping(context, pathOf('person', 'posts'), 'Viewer')).toEqual({ nested: {} });
    expect(getLoaderMapping(context, pathOf('person', 'posts'), 'Person')).toEqual({ nested: {} });
  });
});

describe('a field selected more than once (W-1)', () => {
  // graphql merges every occurrence of a response key into `info.fieldNodes`.
  const variantLater = /* GraphQL */ `
    query { person { id } ...More }
    fragment More on Query { person { ... on Viewer { email } } }
  `;
  const variantFirst = /* GraphQL */ `
    query { ...More person { id } }
    fragment More on Query { person { ... on Viewer { email } } }
  `;

  it('plans every node selecting the field into the one root, whichever occurrence comes first', async () => {
    for (const source of [variantLater, variantFirst]) {
      const info = await resolveInfo(schema, source);

      expect(info.fieldNodes).toHaveLength(2);
      expect(queryFromInfo(adapter, { context: {}, info })).toEqual({
        select: { posts: { take: 5 }, id: true, email: true },
      });
    }
  });

  it('enters the variants of every node before merging any field', async () => {
    const fieldFirst = /* GraphQL */ `
      query { person { posts(take: 2) { id } } ...More }
      fragment More on Query { person { ... on Viewer { email } } }
    `;
    const fragmentFirst = /* GraphQL */ `
      query { ...More person { posts(take: 2) { id } } }
      fragment More on Query { person { ... on Viewer { email } } }
    `;

    for (const source of [fieldFirst, fragmentFirst]) {
      const context = {};
      const info = await resolveInfo(schema, source);

      // Viewer's type-level `posts: { take: 5 }` wins over the other node's field, which loads on
      // its own instead of turning the variant entry into a conflict.
      expect(queryFromInfo(adapter, { context, info })).toEqual({
        select: { posts: { take: 5 }, id: true, email: true },
      });
      expect(getLoaderMapping(context, pathOf('person', 'posts'), 'Person')).toBe(null);
    }
  });

  it('matches the paths of every node selecting the field', async () => {
    const context = {};
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `
        query { entries { ... on AppointmentEntry { appointment { id } } } ...More }
        fragment More on Query {
          entries { ... on AppointmentEntry { appointment { posts { id } } } }
        }
      `,
    );

    expect(info.fieldNodes).toHaveLength(2);
    expect(
      queryFromInfo(adapter, { context, info, typeName: 'User', path: ['appointment'] }),
    ).toEqual({ select: { posts: true } });
    expect(getLoaderMapping(context, pathOf('entries', 'appointment', 'posts'), 'User')).toEqual({
      nested: {},
    });
  });
});

describe('selectionStateFromInfo (E-2)', () => {
  it("merges the field first, then the parent type's selection without conflicts", async () => {
    const info = await resolveInfo(schema, '{ viewer { posts(take: 2) { id } } }', {
      at: ['Viewer', 'posts'],
    });

    const walk = selectionStateFromInfo(adapter, {}, info);

    // The type-level `posts: { take: 5 }` conflicts with the field's own `take: 2` and is left out.
    expect(adapter.serialize(walk.root)).toEqual({ select: { posts: { take: 2 }, id: true } });
    expect(walk.mappings).toEqual({ 'Viewer@posts': { nested: {} } });
  });

  it('plans every node selecting the field into the same row', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        user {
          ... on User { posts(take: 1) { id } }
          ... on User { posts(take: 1) { author { id } } }
        }
      }`,
      { at: ['User', 'posts'] },
    );

    expect(info.fieldNodes).toHaveLength(2);

    const walk = selectionStateFromInfo(adapter, {}, info);

    expect(adapter.serialize(walk.root)).toEqual({
      select: { posts: { take: 1, select: { author: true } } },
    });
    expect(walk.mappings['User@posts'].nested).toEqual({ 'Post@author': { nested: {} } });
  });

  it('keys the mapping by the field alias', async () => {
    const info = await resolveInfo(
      schema,
      '{ user { latest: posts(take: 1) { author { id } } } }',
      {
        at: ['User', 'posts'],
      },
    );

    const walk = selectionStateFromInfo(adapter, {}, info);

    expect(adapter.serialize(walk.root)).toEqual({
      select: { posts: { take: 1, select: { author: true } } },
    });
    expect(Object.keys(walk.mappings)).toEqual(['User@latest']);
    expect(walk.mappings['User@latest'].nested).toEqual({ 'Post@author': { nested: {} } });
  });
});

describe('adapter contract details', () => {
  it('hands fieldSelection the type the field is walked on (W-1)', async () => {
    const seen: string[] = [];
    const spied = createTestAdapter();
    const { fieldSelection } = spied;

    spied.fieldSelection = (field, type) => {
      seen.push(`${type.name}.${field.name}`);

      return fieldSelection(field, type);
    };

    const info = await resolveInfo(schema, '{ user { posts { title } } }');

    queryFromInfo(spied, { context: {}, info });

    expect(seen).toEqual(['User.posts', 'Post.title']);
  });

  it('hands back the query alone for a nested selection on a model-less field (A-1)', async () => {
    const scalar = createTestAdapter();
    const { fieldSelection } = scalar;
    let nested: unknown;

    scalar.fieldSelection = (field, type) =>
      field.name === 'title'
        ? (_args, _ctx, nestedSelection) => {
            nested = nestedSelection({ select: { comments: true } });

            return { select: { title: true } };
          }
        : fieldSelection(field, type);

    const context = {};
    const info = await resolveInfo(schema, '{ user { posts { title } } }');
    const query = queryFromInfo(scalar, { context, info });

    // No walk beneath a String field: the query given is the query returned, unchanged, and the
    // field's own map is merged as any other (Post is in all-columns mode here, so no change).
    expect(nested).toEqual({ select: { comments: true } });
    expect(query).toEqual(queryFromInfo(adapter, { context: {}, info }));
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toMatchObject({
      nested: { 'Post@title': { nested: {} } },
    });
  });

  it('reads nothing of info.parentType without a callbackExtra (A-2)', async () => {
    const info = await resolveInfo(schema, '{ user { posts { id } } }');
    const partial = { ...info, parentType: undefined } as unknown as typeof info;

    expect(queryFromInfo(adapter, { context: {}, info: partial })).toEqual(
      queryFromInfo(adapter, { context: {}, info }),
    );
  });

  it('touches neither the context nor the mappings when the adapter records none (A-3)', async () => {
    const silent = createTestAdapter();

    silent.recordsMappings = false;

    const info = await resolveInfo(schema, '{ user { posts { id } } }');
    const nullContext = null as unknown as object;

    expect(queryFromInfo(silent, { context: nullContext, info })).toEqual(
      queryFromInfo(adapter, { context: {}, info }),
    );
    expect(queryFromWalk(walkFromInfo(silent, { context: nullContext, info })!)).toEqual(
      queryFromInfo(adapter, { context: {}, info }),
    );
    expect([...selectedFieldNames(nullContext, info)]).toEqual(['posts']);
  });
});

describe('walkFromInfo', () => {
  it('returns the walk without recording anything', async () => {
    const context = {};
    const info = await resolveInfo(schema, '{ user { posts { id } } }');

    const walk = walkFromInfo(adapter, { context, info, typeName: 'User' })!;

    expect(adapter.serialize(walk.root)).toEqual({ select: { posts: true } });
    expect(walk.mappings).toEqual({ 'User@posts': { nested: {} } });
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
  });

  it('returns undefined when paths are given and nothing is selected under them', async () => {
    const paths = [['nodes'], ['edges', 'node']];
    const at: [string, string] = ['User', 'postsConnection'];
    const options = { context: {}, typeName: 'Post', paths };

    const empty = await resolveInfo(schema, '{ user { postsConnection { totalCount } } }', { at });

    expect(walkFromInfo(adapter, { ...options, info: empty })).toBeUndefined();

    const nodes = await resolveInfo(
      schema,
      '{ user { postsConnection { nodes { author { id } } } } }',
      {
        at,
      },
    );
    const walk = walkFromInfo(adapter, { ...options, info: nodes })!;

    expect(adapter.serialize(walk.root)).toEqual({ select: { author: true } });
  });
});

describe('queryFromWalk', () => {
  it('emits what queryFromInfo emits with the selection as initial, and records the mappings', async () => {
    const info = await resolveInfo(
      schema,
      '{ user { id posts(take: 2) { id author(x: 1) { name } } } }',
    );
    const select = { select: { profile: true }, take: 1 };
    const expectedContext = {};
    const expected = queryFromInfo(adapter, { context: expectedContext, info, initial: select });
    const context = {};
    const walk = walkFromInfo(adapter, { context, info })!;

    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);

    const query = queryFromWalk(walk, select);

    expect(query).toEqual(expected);
    // The caller's selection comes first, as `initial` does (E-1), so the query is the same
    // object key for key.
    expect(Object.keys(query.select!)).toEqual(Object.keys(expected.select!));
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toEqual(
      getLoaderMapping(expectedContext, pathOf('user', 'posts'), 'User'),
    );
  });

  it('replays a replayable plan over a conflicting selection, which wins as initial does', async () => {
    const info = await resolveInfo(schema, '{ user { id posts(take: 2) { id } } }');
    const select = { select: { posts: { take: 1 } } };
    const expectedContext = {};
    const expected = queryFromInfo(adapter, { context: expectedContext, info, initial: select });
    const context = {};
    const walk = walkFromInfo(adapter, { context, info, replayable: true })!;

    expect(queryFromWalk(walk, select)).toEqual(expected);
    // The document's `posts(take: 2)` lost the conflict: no mapping, it loads on its own.
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toBe(null);
    expect(getLoaderMapping(expectedContext, pathOf('user', 'posts'), 'User')).toBe(null);
    // The walk itself is untouched: emitting it again without a selection gives the plan.
    expect(queryFromWalk(walk)).toEqual(queryFromInfo(adapter, { context: {}, info }));
  });

  it('refuses a conflicting selection when the walk was not built replayable', async () => {
    const info = await resolveInfo(schema, '{ user { posts(take: 2) { id } } }');
    const walk = walkFromInfo(adapter, { context: {}, info })!;

    expect(() => queryFromWalk(walk, { select: { posts: { take: 1 } } })).toThrow(
      'replayable: true',
    );
  });

  it('emits the walked plan alone without a selection', async () => {
    const context = {};
    const info = await resolveInfo(schema, '{ user { posts(take: 2) { id } } }');

    expect(queryFromWalk(walkFromInfo(adapter, { context, info })!)).toEqual(
      queryFromInfo(adapter, { context: {}, info }),
    );
    expect(getLoaderMapping(context, pathOf('user', 'posts'), 'User')).toEqual({ nested: {} });
  });
});
