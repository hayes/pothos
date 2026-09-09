import { getNamedType } from 'graphql';
import { describe, expect, it } from 'vitest';
import { findMatches, includeOf, normalizeInclude, resolveType, selectsPath } from '../src';
import { fieldNodeOf, resolveInfo } from './fake-adapter';
import { createTestAdapter, createTestSchema, models } from './schema';

const schema = createTestSchema();
const adapter = createTestAdapter();
const modelOf = (type: Parameters<typeof adapter.modelFor>[0]) =>
  adapter.modelFor(resolveType(schema, type));

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

  it('drops matches returning a different model than the target (W-10)', async () => {
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

    const matches = findMatches(
      info,
      getNamedType(info.returnType),
      fieldNodeOf(info),
      [[{ name: 'appointment' }]],
      { targetType: schema.getType('User')!, modelOf },
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

describe('selectsPath', () => {
  it('reports whether any field node selects the path, through wrappers', async () => {
    const connection = await resolveInfo(
      schema,
      '{ user { postsConnection { ... on PostConnection { totalCount } } } }',
      { at: ['User', 'postsConnection'] },
    );

    expect(selectsPath(connection, ['totalCount'])).toBe(true);
    expect(selectsPath(connection, ['edges'])).toBe(false);
    expect(selectsPath(connection, [])).toBe(true);

    const wrapped = await resolveInfo(schema, '{ result { ... on Failure { message } } }');

    expect(selectsPath(wrapped, [])).toBe(false);
    expect(selectsPath(wrapped, ['posts'])).toBe(false);

    const success = await resolveInfo(
      schema,
      '{ result { ... on UserSuccess { data { posts { id } } } } }',
    );

    expect(selectsPath(success, [])).toBe(true);
    expect(selectsPath(success, ['posts'])).toBe(true);
    expect(selectsPath(success, ['profile'])).toBe(false);
  });
});

describe('resolveType', () => {
  it('follows indirect includes to the wrapped type', () => {
    expect(resolveType(schema, schema.getType('UserResult')!)).toBe(schema.getType('User'));
    expect(resolveType(schema, schema.getType('User')!)).toBe(schema.getType('User'));
    expect(modelOf(schema.getType('UserResult')!)).toBe(models.User);
  });
});

describe('normalizeInclude', () => {
  it('turns a string path into an include targeting the type at its end', () => {
    const include = normalizeInclude(['edges', 'node'], schema.getType('PostConnection')!);

    expect(include.path).toEqual([{ name: 'edges' }, { name: 'node' }]);
    expect(include.getType()).toBe('Post');
  });

  it('lets an explicit type override the target', () => {
    const include = normalizeInclude([], schema.getType('User')!, schema.getType('Viewer')!);

    expect(include.path).toEqual([]);
    expect(include.getType()).toBe('Viewer');
  });

  it('rejects unknown fields and non-object types along the path', () => {
    expect(() => normalizeInclude(['missing'], schema.getType('User')!)).toThrow(
      'Expected User to have a field missing',
    );
    expect(() => normalizeInclude(['name'], schema.getType('User')!)).toThrow(
      'Expected String to be an Object or Interface type',
    );
  });
});
