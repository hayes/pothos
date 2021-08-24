import { gql } from 'apollo-server';
import { execute, printSchema } from 'graphql';
import { createContext } from './example/context';
import schema from './example/schema';

describe('dataloader', () => {
  it('generates expected schema', () => {
    expect(printSchema(schema)).toMatchSnapshot();
  });

  describe('queries', () => {
    it('valid queries', async () => {
      const query = gql`
        query {
          counts {
            name
            calls
            loaded
          }
          users {
            id
          }
          user {
            id
            idFromInterface
          }
          userWithErrors {
            __typename
            ... on BaseError {
              message
            }
            ... on QueryUserWithErrorsSuccess {
              data {
                id
              }
            }
          }
          userWithoutError: userWithErrors(id: "1") {
            __typename
            ... on BaseError {
              message
            }
            ... on QueryUserWithErrorsSuccess {
              data {
                id
              }
            }
          }
          usersWithErrors {
            __typename
            ... on BaseError {
              message
            }
            ... on QueryUsersWithErrorsSuccess {
              data {
                id
              }
            }
          }
          usersWithoutError: usersWithErrors(ids: ["1", "2"]) {
            __typename
            ... on BaseError {
              message
            }
            ... on QueryUsersWithErrorsSuccess {
              data {
                id
              }
            }
          }
          userNodes {
            id
          }
          userNode {
            id
            idFromInterface
          }
          userNodes2: userNodes {
            id
          }
          userNode2: userNode {
            id
          }
          nullableUsers {
            id
          }
          nullableUser {
            id
          }
          nodes(ids: ["VXNlck5vZGU6MTIz", "VXNlck5vZGU6NDU2"]) {
            id
          }
          user2: user(id: "2") {
            id
          }
          posts(ids: [123, 456]) {
            id
            title
            content
          }
          posts2: posts(ids: [123, 789]) {
            id
            title
            content
          }
          post(id: 1) {
            id
          }
          post2: post(id: 2) {
            id
          }
          fromContext1 {
            id
          }
          fromContext2 {
            id
          }
          fromContext3 {
            id
          }
          fromContext4 {
            id
          }
          classThing {
            id
          }
          classThingRef {
            id
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: createContext(),
      });

      expect(result).toMatchSnapshot();
    });

    it('query with errors', async () => {
      const query = gql`
        query {
          counts {
            name
            calls
            loaded
          }
          users(ids: ["-123", "-456", "789"]) {
            id
          }
          user(id: "-123") {
            id
          }
          userNodes(ids: ["-123", "-456", "789"]) {
            id
          }
          userNode(id: "-123") {
            id
          }
          user2: user(id: "2") {
            id
          }
          posts(ids: [-123, -456, 780]) {
            id
            title
            content
          }
          post(id: -1) {
            id
          }
          post2: post(id: 2) {
            id
          }
        }
      `;

      const result = await execute({
        schema,
        document: query,
        contextValue: createContext(),
      });

      expect(result.data).toMatchSnapshot();
      expect(result.errors).toMatchInlineSnapshot(`
        Array [
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
          [GraphQLError: Invalid ID -1],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -123],
          [GraphQLError: Invalid ID -456],
        ]
      `);
    });
  });
});
