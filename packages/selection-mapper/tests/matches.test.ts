import { getNamedType } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  findMatches,
  includeOf,
  matchesForModel,
  modelOf,
  normalizeInclude,
  resolveType,
  selectedFieldNames,
} from '../src/matches.js';
import { fieldNodeOf, resolveInfo } from './fake-adapter';
import { createTestAdapter, createTestSchema, models } from './schema';

const schema = createTestSchema();
const adapter = createTestAdapter();

describe('findMatches', () => {
  it('finds the field at the end of a path under every fragment, in document order', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        entries {
          ... on AppointmentEntry { appointment { id } }
          ... on VariantEntry { appointment { email } }
          ... on OtherEntry { appointment { title } }
        }
      }`,
    );

    const matches = findMatches(info, getNamedType(info.returnType), fieldNodeOf(info), [
      [{ name: 'appointment' }],
    ]);

    expect(matches.map((match) => [match.type.name, match.path, match.deferred])).toEqual([
      ['User', ['appointment'], false],
      ['Viewer', ['appointment'], false],
      ['Post', ['appointment'], false],
    ]);
  });

  it('matchesForModel drops matches returning a different model than the target (W-10)', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        entries {
          ... on AppointmentEntry { appointment { id } }
          ... on VariantEntry { appointment { email } }
          ... on OtherEntry { appointment { title } }
        }
      }`,
    );

    const matches = matchesForModel(
      adapter,
      schema,
      findMatches(info, getNamedType(info.returnType), fieldNodeOf(info), [
        [{ name: 'appointment' }],
      ]),
      schema.getType('User')!,
    );

    expect(matches.map((match) => match.type.name)).toEqual(['User', 'Viewer']);
  });

  it('follows named fragments, aliases and skip directives, and flags deferred matches', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `
        query ($skip: Boolean!) {
          user {
            postsConnection {
              ...Nodes
              ... @defer { edges { node { id } } }
              hidden: edges @skip(if: $skip) { node { id } }
            }
          }
        }
        fragment Nodes on PostConnection { items: nodes { id } }
      `,
      { variableValues: { skip: true } },
    );
    const connection = schema.getType('PostConnection')!;
    const fieldNode = fieldNodeOf(info).selectionSet!.selections[0];

    const matches = findMatches(
      info,
      connection,
      fieldNode as never,
      [[{ name: 'nodes' }], [{ name: 'edges' }, { name: 'node' }]],
      { path: ['postsConnection'] },
    );

    expect(matches.map((match) => [match.path, match.deferred])).toEqual([
      [['postsConnection', 'items'], false],
      [['postsConnection', 'edges', 'node'], true],
    ]);
  });

  it('prepends a type-level path and pins fragment types by segment', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        result {
          ... on UserSuccess { data { posts { id } } }
          ... on Failure { message }
        }
      }`,
    );
    const returnType = getNamedType(info.returnType);

    const matches = findMatches(info, returnType, fieldNodeOf(info), [[{ name: 'posts' }]], {
      prefix: includeOf(returnType)?.path,
    });

    expect(matches.map((match) => [match.type.name, match.path])).toEqual([
      ['Post', ['data', 'posts']],
    ]);
  });

  it('expands a fragment spread more than once at one point of the walk once (W-2)', async () => {
    // F1 spreads F2 twice, F2 spreads F3 twice, and so on: 2^11 spreads reach F12.
    const fragments: string[] = [];

    for (let i = 1; i < 12; i += 1) {
      fragments.push(`fragment F${i} on Person { ...F${i + 1} ...F${i + 1} }`);
    }

    fragments.push('fragment F12 on Person { posts { id } }');

    const info = await resolveInfo(schema, `{ person { ...F1 } }\n${fragments.join('\n')}`);
    const started = performance.now();
    const matches = findMatches(info, getNamedType(info.returnType), fieldNodeOf(info), [
      [{ name: 'posts' }],
    ]);

    expect(performance.now() - started).toBeLessThan(1000);
    expect(matches.map((match) => [match.type.name, match.path])).toEqual([['Post', ['posts']]]);
  });

  it('expands a fragment again under another alias path', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `
        { user { a: posts { ...Author } b: posts { ...Author } } }
        fragment Author on Post { author { id } }
      `,
    );

    const matches = findMatches(info, getNamedType(info.returnType), fieldNodeOf(info), [
      [{ name: 'posts' }, { name: 'author' }],
    ]);

    expect(matches.map((match) => match.path)).toEqual([
      ['a', 'author'],
      ['b', 'author'],
    ]);
  });

  it('ignores fragments under @skip and @include (S-2)', async () => {
    const info = await resolveInfo(
      schema,
      /* GraphQL */ `{
        entries {
          ... on AppointmentEntry @skip(if: true) { appointment { id } }
          ...Variant @include(if: false)
          ... on OtherEntry @include(if: true) { appointment { title } }
        }
      }
      fragment Variant on VariantEntry { appointment { email } }`,
    );

    const matches = findMatches(info, getNamedType(info.returnType), fieldNodeOf(info), [
      [{ name: 'appointment' }],
    ]);

    expect(matches.map((match) => match.type.name)).toEqual(['Post']);
  });
});

describe('selectedFieldNames', () => {
  it('reports the fields beneath the field, through fragments, directives, and wrappers', async () => {
    const connection = await resolveInfo(
      schema,
      /* GraphQL */ `
        {
          user {
            postsConnection {
              ... on PostConnection { totalCount }
              ...Edges
              pageInfo @skip(if: true) { hasNextPage }
            }
          }
        }
        fragment Edges on PostConnection { edges { cursor } }
      `,
      { at: ['User', 'postsConnection'] },
    );

    expect([...selectedFieldNames({}, connection)]).toEqual(['totalCount', 'edges']);

    const wrapped = await resolveInfo(schema, '{ result { ... on Failure { message } } }');

    expect([...selectedFieldNames({}, wrapped)]).toEqual([]);

    const success = await resolveInfo(
      schema,
      '{ result { ... on UserSuccess { data { posts { id } profile { bio } } } } }',
    );

    expect([...selectedFieldNames({}, success)]).toEqual(['posts', 'profile']);
  });

  it('reads the selection once per execution for the same field nodes (W-3)', async () => {
    const info = await resolveInfo(schema, '{ user { postsConnection { totalCount } } }', {
      at: ['User', 'postsConnection'],
    });
    const context = {};
    const names = selectedFieldNames(context, info);

    // graphql builds a new info per row, and (since 17) a new `fieldNodes` array around the same
    // nodes.
    expect(selectedFieldNames(context, { ...info })).toBe(names);
    expect(selectedFieldNames(context, { ...info, fieldNodes: [...info.fieldNodes] })).toBe(names);
    // Another request, or another execution (whose variables may skip other fields), reads again.
    expect(selectedFieldNames({}, info)).not.toBe(names);
    expect(
      selectedFieldNames(context, { ...info, variableValues: { ...info.variableValues } }),
    ).not.toBe(names);
  });
});

describe('resolveType', () => {
  it('follows indirect includes to the wrapped type', () => {
    expect(resolveType(schema, schema.getType('UserResult')!)).toBe(schema.getType('User'));
    expect(resolveType(schema, schema.getType('User')!)).toBe(schema.getType('User'));
    expect(modelOf(adapter, schema, schema.getType('UserResult')!)).toBe(models.User);
  });
});

describe('normalizeInclude', () => {
  it('turns a string path into an include targeting the type at its end', () => {
    const include = normalizeInclude(
      ['edges', 'node'],
      schema.getType('PostConnection')!,
      undefined,
      schema,
    );

    expect(include.path).toEqual([{ name: 'edges' }, { name: 'node' }]);
    expect(include.getType()).toBe('Post');
  });

  it('lets an explicit type override the target', () => {
    const include = normalizeInclude(
      [],
      schema.getType('User')!,
      schema.getType('Viewer')!,
      schema,
    );

    expect(include.path).toEqual([]);
    expect(include.getType()).toBe('Viewer');
  });

  it('looks a typed segment up on the type it pins', () => {
    // The field only exists on the implementations, each returning a different type.
    const include = normalizeInclude(
      [{ name: 'appointment', type: 'OtherEntry' }],
      schema.getType('Entry')!,
      undefined,
      schema,
    );

    expect(include.path).toEqual([{ name: 'appointment', type: 'OtherEntry' }]);
    expect(include.getType()).toBe('Post');

    // A pin also names the member of a union the path goes through.
    const viaUnion = normalizeInclude(
      [{ name: 'data', type: 'UserSuccess' }],
      schema.getType('UserResult')!,
      undefined,
      schema,
    );

    expect(viaUnion.path).toEqual([{ name: 'data', type: 'UserSuccess' }]);
    expect(viaUnion.getType()).toBe('User');
  });

  it('rejects unknown fields, unknown pinned types, and non-object types along the path', () => {
    expect(() => normalizeInclude(['missing'], schema.getType('User')!, undefined, schema)).toThrow(
      'Expected User to have a field missing',
    );
    expect(() => normalizeInclude(['name'], schema.getType('User')!, undefined, schema)).toThrow(
      'Expected String to be an Object or Interface type',
    );
    expect(() =>
      normalizeInclude(
        [{ name: 'appointment', type: 'Nope' }],
        schema.getType('Entry')!,
        undefined,
        schema,
      ),
    ).toThrow('Unknown type Nope in nested selection path segment appointment');
    expect(() =>
      normalizeInclude(['data'], schema.getType('UserResult')!, undefined, schema),
    ).toThrow('Expected UserResult to be an Object type');
  });
});
