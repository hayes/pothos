import { getNamedType } from 'graphql';
import { expect, it } from 'vitest';
import { Plan, selectedFieldNames } from '../src';
import { createModels, createSchema, FakeAdapter, resolveInfo, unexpected } from './fake-adapter';

it.each([
  true,
  false,
])('uses the same field names during planning and resolution (rows=%s)', async (rows) => {
  const seen: ReadonlySet<string>[] = [];
  const models = createModels('User');
  const schema = createSchema(
    `
    type Query { user: User }
    type User { id: ID connection: Result }
    union Result = Success | Failure
    type Success { data: Connection }
    type Failure { message: String }
    type Connection { totalCount: Int pageSize: Int }
  `,
    {
      User: {
        model: 'User',
        select: { select: { id: true } },
        fields: {
          connection: (_args, _ctx, _nested, selected) => {
            const names = selected();
            expect(selected()).toBe(names);
            expect(selected(['totalCount'])?.name.value ?? null).toBe(
              names.has('totalCount') ? 'totalCount' : null,
            );
            seen.push(names);
            return { select: { id: true } };
          },
        },
      },
      Result: {
        extensions: {
          pothosIndirectInclude: {
            getType: () => 'Connection',
            path: [{ name: 'data', type: 'Success' }],
          },
        },
      },
    },
  );
  const source = `query ($rows: Boolean!) {
    user {
      connection { ...Count ...Count }
      connection { ... on Success { data { alias: pageSize @include(if: $rows) } } }
    }
  }
  fragment Count on Result { ... on Success { data { count: totalCount } } }`;
  const options = { variableValues: { rows } };
  const info = await resolveInfo(schema, source, options);
  const plan = await Plan.fromInfo(new FakeAdapter(models), { context: {}, info });
  plan!.query();
  const resolvedInfo = await resolveInfo(schema, source, {
    ...options,
    at: ['User', 'connection'],
  });
  const expected = selectedFieldNames({}, resolvedInfo);
  expect(getNamedType(resolvedInfo.returnType).name).toBe('Result');
  expect(new Set(seen.flatMap((names) => [...names]))).toEqual(expected);
  expect(expected).toEqual(new Set(rows ? ['totalCount', 'pageSize'] : ['totalCount']));
});

async function argsAt(path: string[], selection: string | string[], variableValues = {}) {
  let read: () => unknown = () => undefined;
  const models = createModels('User');
  const schema = createSchema(
    `
    type Query { user: User }
    type User { id: ID activity(take: Int): Result }
    union Result = Success | Failure
    type Success { data: Activity }
    type Failure { message: String }
    type Activity { posts(first: Int, after: String, size: Int = 5): Int }
  `,
    {
      User: {
        model: 'User',
        select: { select: { id: true } },
        fields: {
          activity: (_args, _ctx, _nested, selected) => {
            read = () => selected.args(path);
            return { select: { id: true } };
          },
        },
      },
      Result: {
        extensions: {
          pothosIndirectInclude: {
            getType: () => 'Activity',
            path: [{ name: 'data', type: 'Success' }],
          },
        },
      },
    },
  );
  // An array selects each part beneath its own node of the field, which graphql merges.
  const activity = (part: string) => `activity(take: 3) { ... on Success { data { ${part} } } }`;
  const source = `query ($first: Int, $after: String) {
    user { ${(Array.isArray(selection) ? selection : [selection]).map(activity).join(' ')} }
  }`;
  const info = await resolveInfo(schema, source, { variableValues });
  const plan = await Plan.fromInfo(new FakeAdapter(models), { context: {}, info });
  plan!.query();
  return read();
}

it('reads the arguments of a field beneath the selection, through a wrapper', async () => {
  const variables = { first: 2, after: 'abc' };
  const posts = 'posts(first: $first, after: $after)';
  expect(await argsAt([], posts, variables)).toEqual({});
  expect(await argsAt(['posts'], posts, variables)).toEqual({ first: 2, after: 'abc', size: 5 });
  expect(await argsAt(['missing'], posts, variables)).toBeNull();
  expect(await argsAt(['posts'], `a: ${posts} b: ${posts}`, variables)).toEqual({
    first: 2,
    after: 'abc',
    size: 5,
  });
});

it.each([
  ['one selection', 'a: posts(first: 1) b: posts(first: 5)'],
  ['selections graphql merges', ['a: posts(first: 1)', 'b: posts(first: 5)']],
])('throws for fields at the path with different arguments, in %s', async (_, selection) => {
  await expect(argsAt(['posts'], selection)).rejects.toThrow(
    unexpected('The fields selected at posts beneath User.activity have different arguments.'),
  );
});

it('reads the arguments of fields at the path in selections graphql merges', async () => {
  expect(await argsAt(['posts'], ['a: posts(first: 1)', 'b: posts(first: 1)'])).toEqual({
    first: 1,
    size: 5,
  });
});

/** Plans `selection` on a user, reading the arguments at `posts` while `activity` is selected. */
async function plannedArgs(selection: string) {
  const seen: unknown[] = [];
  const models = createModels('User');
  const schema = createSchema(
    `
    type Query { user: User }
    type User { id: ID friend: User activity: Activity }
    type Activity { posts(first: Int, last: Int): Int }
  `,
    {
      User: {
        model: 'User',
        select: { select: { id: true } },
        fields: {
          friend: (_args, _ctx, nested) => ({ select: { friend: nested({}) } }),
          activity: (_args, _ctx, _nested, selected) => {
            seen.push(selected.args(['posts']));
            return { select: { id: true } };
          },
        },
      },
    },
  );
  const info = await resolveInfo(schema, `{ user { ${selection} } } ${FRAGMENTS}`);
  const plan = await Plan.fromInfo(new FakeAdapter(models), { context: {}, info });
  plan!.query();
  return seen;
}

const FRAGMENTS = `
  fragment First on User { activity { a: posts(first: 1) } }
  fragment Last on User { activity { b: posts(last: 1) } }
  fragment FriendFirst on User { friend { ...First } }
  fragment FriendLast on User { friend { ...Last } }
`;
const FIRST = 'activity { a: posts(first: 1) }';
const LAST = 'activity { b: posts(last: 1) }';

it.each([
  ['one level down', `friend { ${FIRST} } friend { ${LAST} }`],
  ['two levels down', `friend { friend { ${FIRST} } } friend { friend { ${LAST} } }`],
  ['a parent selected twice above another', `friend { friend { ${FIRST} } friend { ${LAST} } }`],
  ['inline fragments', `... on User { friend { ${FIRST} } } ... { friend { ${LAST} } }`],
  ['named fragments', '...FriendFirst ...FriendLast'],
  ['named fragments beneath the parent', 'friend { ...First } friend { ...Last }'],
  [
    'parents that each share a walk with another alias',
    `x: friend { ${FIRST} } y: friend { ${LAST} } friend { ${FIRST} } friend { ${LAST} }`,
  ],
])('throws for different arguments beneath a parent selected twice: %s', async (_, selection) => {
  await expect(plannedArgs(selection)).rejects.toThrow(
    unexpected('The fields selected at posts beneath User.activity have different arguments.'),
  );
});

it.each([
  ['the same alias', `friend { ${FIRST} } friend { ${FIRST} }`],
  ['another alias', `friend { ${FIRST} } friend { activity { c: posts(first: 1) } }`],
  ['a fragment spread twice', 'friend { ...First } friend { ...First }'],
  ['two levels down', `friend { friend { ...First } } friend { friend { ${FIRST} } }`],
])('reads the same arguments beneath a parent selected twice: %s', async (_, selection) => {
  const seen = await plannedArgs(selection);

  expect(seen.length).toBeGreaterThan(0);
  expect(new Set(seen.map((args) => JSON.stringify(args)))).toEqual(new Set(['{"first":1}']));
});

it('reads only the arguments beneath its own alias of the parent', async () => {
  expect(await plannedArgs(`x: friend { ${FIRST} } y: friend { ${LAST} }`)).toEqual([
    { first: 1 },
    { last: 1 },
  ]);
});
