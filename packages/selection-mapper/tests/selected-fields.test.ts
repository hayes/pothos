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

async function argsAt(path: string[], selection: string, variableValues = {}) {
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
  const source = `query ($first: Int, $after: String) {
    user { activity(take: 3) { ... on Success { data { ${selection} } } } }
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

it('throws for fields at the path with different arguments', async () => {
  await expect(argsAt(['posts'], 'a: posts(first: 1) b: posts(first: 5)')).rejects.toThrow(
    unexpected('The fields selected at posts beneath User.activity have different arguments.'),
  );
});
