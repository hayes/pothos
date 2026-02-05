import SchemaBuilder from '@pothos/core';
import { execute, printSchema } from 'graphql';
import { gql } from 'graphql-tag';
import RelayPlugin from '../src';
import schemaWithGlobalConnectionFields from './examples/global-connection-fields/schema';
import schemaWithAdditionalInterfaces from './examples/node-with-interfaces/schema';
import schema from './examples/relay/schema';

describe('relay example schema', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  it('generates expected schema with globalConnectionFields', () => {
    expect(printSchema(schemaWithGlobalConnectionFields)).toMatchSnapshot();
  });

  it('generates expected schema with additional interfaces', () => {
    expect(printSchema(schemaWithAdditionalInterfaces)).toMatchSnapshot();
  });

  it('generates expected schema with custom PageInfo name', () => {
    const builder = new SchemaBuilder({
      plugins: [RelayPlugin],
      relay: {
        pageInfoTypeOptions: {
          name: 'CustomPageInfo',
        },
      },
    });

    builder.queryType({
      fields: (t) => ({
        test: t.connection({
          type: builder.objectRef<{ id: string }>('Test').implement({
            fields: (t2) => ({ id: t2.exposeID('id') }),
          }),
          resolve: () => ({
            edges: [],
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
            },
          }),
        }),
      }),
    });

    const customSchema = builder.toSchema();
    const schemaString = printSchema(customSchema);
    expect(schemaString).toContain('type CustomPageInfo');
    expect(schemaString).not.toContain('type PageInfo {');
    expect(schemaString).toMatchSnapshot();
  });

  it('generates expected schema with custom Node name', () => {
    const builder = new SchemaBuilder({
      plugins: [RelayPlugin],
      relay: {
        nodeTypeOptions: {
          name: 'CustomNode',
          description: 'Custom node interface',
        },
      },
    });

    const TestNode = builder.objectRef<{ id: string }>('TestNode');

    builder.node(TestNode, {
      id: {
        resolve: (obj) => obj.id,
      },
      loadOne: () => ({ id: '1' }),
      fields: (t) => ({
        value: t.string({ resolve: () => 'test' }),
      }),
    });

    builder.queryType({});

    const customSchema = builder.toSchema();
    const schemaString = printSchema(customSchema);
    expect(schemaString).toContain('interface CustomNode');
    expect(schemaString).toContain('Custom node interface');
    expect(schemaString).not.toContain('interface Node {');
    expect(schemaString).toMatchSnapshot();
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
          oddNumbers(first: 3) {
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
          moreOddNumbers: oddNumbers(first: 3, after: "T2Zmc2V0Q29ubmVjdGlvbjow") {
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
          sharedConnection {
            edges {
              cursor
              node {
                id
              }
            }
          }
          sharedConnectionAndEdge {
            edges {
              cursor
              node {
                id
              }
            }
          }
          sharedEdgeConnection {
            edges {
              cursor
              node {
                id
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
            connectionField
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              edgeField
              cursor
              node {
                number
              }
            }
          },
          batchNumbersLast: batchNumbers(last: 3) {
            connectionField
            totalCount
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
            edges {
              edgeField
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
            idList: [null, "YWJjOjEyMw=="]
            inputObj: {
              id: "YWJjOjEyMw=="
              idList: [null, "YWJjOjEyMw=="]
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

      expect(result.data).toMatchInlineSnapshot(`
        {
          "inputGlobalID": "{"id":{"typename":"abc","id":"123"},"idList":[null,{"typename":"abc","id":"123"}],"inputObj":{"circular":{"id":{"typename":"abc","id":"123"},"idList":[{"typename":"abc","id":"123"}],"otherList":[{"someField":"abc"}]},"id":{"typename":"abc","id":"123"},"idList":[null,{"typename":"abc","id":"123"}],"otherList":[{"someField":"abc"}]},"normalId":"123"}",
        }
      `);
    });

    it('nodeRef', async () => {
      const query = gql`
        {
          numberNodeRef {
            id
            number
            __typename
          }
          node(id: "TnVtYmVyUmVmOjEyMw==") {
            id
            __typename
            number
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result.data).toMatchInlineSnapshot(`
        {
          "node": {
            "__typename": "NumberRef",
            "id": "TnVtYmVyUmVmOjEyMw==",
          },
          "numberNodeRef": {
            "__typename": "NumberThingNodeRef",
            "id": "TnVtYmVyVGhpbmdOb2RlUmVmOjEyMw==",
            "number": 123,
          },
        }
      `);
    });
  });

  it('branded nodes', async () => {
    const query = gql`
      query {
        node(id: "TnVtYmVyUmVmOjEyMw==") {
          id
          __typename
        }
      }
    `;

    const result = await execute({
      schema,
      document: query,
      contextValue: {},
    });

    expect(result.data).toMatchInlineSnapshot(`
      {
        "node": {
          "__typename": "NumberRef",
          "id": "TnVtYmVyUmVmOjEyMw==",
        },
      }
    `);
  });

  describe('mutations', () => {
    it('returns correct clientMutationId', async () => {
      const query = gql`
        mutation {
          a: exampleMutation(input: { clientMutationId: "a", id: "123" }) {
            clientMutationId
            itWorked
          }
          b: exampleMutation(input: { clientMutationId: "b", id: "345" }) {
            clientMutationId
            itWorked
          }
          exampleWithDescriptions(customInput: { clientMutationId: "c", id: "123" }) {
            clientMutationId
            itWorked
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "a": {
              "clientMutationId": "a",
              "itWorked": true,
            },
            "b": {
              "clientMutationId": "b",
              "itWorked": false,
            },
            "exampleWithDescriptions": {
              "clientMutationId": "c",
              "itWorked": true,
            },
          },
        }
      `);
    });
  });

  describe('connection.nodes', () => {
    it('can query nodes on connection', async () => {
      const query = gql`
        query {
          oddNumbers(first: 2) {
            edges {
              node {
                nodeId
              }
            }
            nodes {
              nodeId
            }
          }
        }
      `;

      const result = await execute({
        schema: schemaWithGlobalConnectionFields,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "oddNumbers": {
              "edges": [
                {
                  "node": {
                    "nodeId": "TnVtYmVyOjE=",
                  },
                },
                null,
              ],
              "nodes": [
                {
                  "nodeId": "TnVtYmVyOjE=",
                },
                null,
              ],
            },
          },
        }
      `);
    });
  });

  describe('parsing global ids', () => {
    it('parses ids', async () => {
      const query = gql`
        query {
          idWithColon(id: "SURXaXRoQ29sb246MTp0ZXN0") {
            id
            idString
          }
          idsWithColon(ids: ["SURXaXRoQ29sb246MTp0ZXN0", "SURXaXRoQ29sb246Mjp0ZXN0OmV4YW1wbGU="]) {
            id
            idString
          }
          numberThingByID(id: "TnVtYmVyOjE=") {
            id
            number
          }
          numberThingsByIDs(ids: ["TnVtYmVyOjE=", "TnVtYmVyOjI="]) {
            id
            number
          }
          invalid: numberThingByID(id: "T3RoZXI6Mg==") {
            id
            number
          }
          invalidList: numberThingsByIDs(ids: ["T3RoZXI6Mg=="]) {
            id
            number
          }
          echoIDs(
            globalID: "TnVtYmVyOjE="
            numberThingID: "TnVtYmVyOjE="
            genericNumberThingID: "TnVtYmVyOjE="
          ) {
            id
            typename
            arg
            idType
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchInlineSnapshot(`
        {
          "data": {
            "echoIDs": [
              {
                "arg": "globalID",
                "id": "1",
                "idType": "string",
                "typename": "Number",
              },
              {
                "arg": "numberThingID",
                "id": "1",
                "idType": "number",
                "typename": "Number",
              },
              {
                "arg": "genericNumberThingID",
                "id": "1",
                "idType": "string",
                "typename": "Number",
              },
            ],
            "idWithColon": {
              "id": "SURXaXRoQ29sb246MTp0ZXN0",
              "idString": "1:test",
            },
            "idsWithColon": [
              {
                "id": "SURXaXRoQ29sb246MTp0ZXN0",
                "idString": "1:test",
              },
              {
                "id": "SURXaXRoQ29sb246Mjp0ZXN0OmV4YW1wbGU=",
                "idString": "2:test:example",
              },
            ],
            "invalid": null,
            "invalidList": null,
            "numberThingByID": {
              "id": "TnVtYmVyOjE=",
              "number": 1,
            },
            "numberThingsByIDs": [
              {
                "id": "TnVtYmVyOjE=",
                "number": 1,
              },
              {
                "id": "TnVtYmVyOjI=",
                "number": 2,
              },
            ],
          },
          "errors": [
            [GraphQLError: ID: T3RoZXI6Mg== is not of type: Number],
            [GraphQLError: ID: T3RoZXI6Mg== is not of type: Number],
          ],
        }
      `);
    });
  });
});
