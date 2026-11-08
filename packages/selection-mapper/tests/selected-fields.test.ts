import { getNamedType } from 'graphql';
import { expect, it } from 'vitest';
import { Plan, selectedFieldNames } from '../src';
import { createModels, createSchema, FakeAdapter, resolveInfo } from './fake-adapter';

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
