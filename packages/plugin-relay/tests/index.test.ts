import { gql } from 'apollo-server';
import { execute, lexicographicSortSchema, printSchema } from 'graphql';
import schema from './examples/relay/schema';

describe('relay example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });

  describe('queries', () => {
    it('query offset based connections', async () => {
      const query = gql`
        {
          numbers(first: 3) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAfterAtEnd: numbers(first: 3, after: "T2Zmc2V0Q29ubmVjdGlvbjoxOTc=") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAfter: numbers(first: 3, after: "T2Zmc2V0Q29ubmVjdGlvbjox") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          lastAtBegining: numbers(before: "T2Zmc2V0Q29ubmVjdGlvbjox") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          lastBefore: numbers(last: 3, before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA==") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          beforeAndAfter: numbers(
            before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA=="
            after: "T2Zmc2V0Q29ubmVjdGlvbjo3"
          ) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAndLast: numbers(first: 5, last: 2, before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA==") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });

    it('query array based connections', async () => {
      const query = gql`
        {
          batchNumbers(first: 3) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAfterAtEnd: batchNumbers(first: 3, after: "T2Zmc2V0Q29ubmVjdGlvbjoxOTc=") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAfter: batchNumbers(first: 3, after: "T2Zmc2V0Q29ubmVjdGlvbjox") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          lastAtBegining: batchNumbers(before: "T2Zmc2V0Q29ubmVjdGlvbjox") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          lastBefore: batchNumbers(last: 3, before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA==") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          beforeAndAfter: batchNumbers(
            before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA=="
            after: "T2Zmc2V0Q29ubmVjdGlvbjo3"
          ) {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
          firstAndLast: batchNumbers(first: 5, last: 2, before: "T2Zmc2V0Q29ubmVjdGlvbjoxMA==") {
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              cursor
              node {
                number
              }
            }
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });

    it('query node and nodes on query type', async () => {
      const query = gql`
        {
          extraNode {
            __typename
            ... on Number {
              number
            }
          }
          moreNodes {
            __typename
            ... on BatchNumber {
              batchNumber: number
            }
            ... on Number {
              number
            }
          }
          nodes(ids: ["TnVtYmVyOjQ=", "TnVtYmVyOjI=", "TnVtYmVyOjI=", "QmF0Y2hOdW1iZXI6MA=="]) {
            ... on BatchNumber {
              batchNumber: number
            }
            ... on Number {
              number
            }
          }

          batchNode: node(id: "QmF0Y2hOdW1iZXI6MA==") {
            ... on BatchNumber {
              number
            }
          }
          node(id: "TnVtYmVyOjI=") {
            id
            ... on Number {
              number
            }
          }

          node2: node(id: "TnVtYmVyOjI=") {
            ... on Number {
              number
            }
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });

    it('globalID inputs', async () => {
      const query = gql`
        {
          inputGlobalID(
            id: "YWJjOjEyMw=="
            normalId: 123
            inputObj: {
              id: "YWJjOjEyMw=="
              idList: ["YWJjOjEyMw=="]
              circular: { id: "YWJjOjEyMw==", idList: ["YWJjOjEyMw=="] }
            }
          )
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(JSON.parse(result.data!.inputGlobalID)).toMatchInlineSnapshot(`
        Object {
          "id": Object {
            "id": "123",
            "typename": "abc",
          },
          "inputObj": Object {
            "circular": Object {
              "id": Object {
                "id": "123",
                "typename": "abc",
              },
              "idList": Array [
                Object {
                  "id": "123",
                  "typename": "abc",
                },
              ],
            },
            "id": Object {
              "id": "123",
              "typename": "abc",
            },
            "idList": Array [
              Object {
                "id": "123",
                "typename": "abc",
              },
            ],
          },
          "normal": "123",
        }
      `);
    });
  });
});
