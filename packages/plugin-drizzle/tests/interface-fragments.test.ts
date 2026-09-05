import { execute } from '@pothos/test-utils';
import type { DocumentNode } from 'graphql';
import { gql } from 'graphql-tag';
import { createContext } from './example/context';
import { clearDrizzleLogs, drizzleLogs } from './example/db';
import { schema } from './example/schema';

async function planFor(query: DocumentNode) {
  const context = await createContext({ userId: '1' });
  clearDrizzleLogs();

  const result = await execute({
    schema,
    document: query,
    contextValue: context,
  });

  return { result, logs: [...drizzleLogs] };
}

describe('fragments on interfaces implemented by drizzle objects', () => {
  afterEach(() => {
    clearDrizzleLogs();
  });

  it('plans a fragment spread on the interface like a fragment on the object', async () => {
    const onObject = await planFor(gql`
      query {
        me {
          ... on NormalViewer {
            ...ViewerRoles
          }
        }
      }

      fragment ViewerRoles on NormalViewer {
        id
        roles
      }
    `);

    const onInterface = await planFor(gql`
      query {
        me {
          ... on NormalViewer {
            ...ViewerRoles
          }
        }
      }

      fragment ViewerRoles on Viewer {
        id
        roles
      }
    `);

    expect(onObject.result).toMatchInlineSnapshot(`
      {
        "data": {
          "me": {
            "id": "1",
            "roles": [
              "admin",
              "author",
              "user",
            ],
          },
        },
      }
    `);
    expect(onObject.logs).toMatchInlineSnapshot(`
      [
        "Query: select "d0"."id" as "id", coalesce((select json_group_array(json_object('id', "id", 'name', "name")) as "r" from (select "d1"."id" as "id", "d1"."name" as "name" from "roles" as "d1" inner join "user_roles" as "tr0" on "tr0"."role_id" = "d1"."id" where "d0"."id" = "tr0"."user_id") as "t"), jsonb_array()) as "roles" from "users" as "d0" where "d0"."id" = ? limit ? -- params: [1, 1]",
      ]
    `);

    expect(onInterface.result).toEqual(onObject.result);
    expect(onInterface.logs).toEqual(onObject.logs);
  });

  it('plans an inline fragment on the interface like a fragment on the object', async () => {
    const onObject = await planFor(gql`
      query {
        me {
          ... on NormalViewer {
            ... on NormalViewer {
              id
              roles
            }
          }
        }
      }
    `);

    const onInterface = await planFor(gql`
      query {
        me {
          ... on NormalViewer {
            ... on Viewer {
              id
              roles
            }
          }
        }
      }
    `);

    expect(onObject.logs).toHaveLength(1);
    expect(onObject.logs[0]).toContain('from "roles"');

    expect(onInterface.result).toEqual(onObject.result);
    expect(onInterface.logs).toEqual(onObject.logs);
  });
});
