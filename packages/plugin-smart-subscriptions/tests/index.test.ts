import {
  execute,
  ExecutionResult,
  GraphQLResolveInfo,
  lexicographicSortSchema,
  printSchema,
  subscribe,
} from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import gql from 'graphql-tag';
import { stringPath } from '../src';
import { Poll } from './example/data';
import schema from './example/schema';

describe('smart subscriptions', () => {
  it('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(schema))).toMatchSnapshot();
  });

  it('subscribe', async () => {
    const query = gql`
      subscription subscribe {
        polls {
          id
          answers {
            count
          }
        }
      }
    `;

    const pubsub = new PubSub();

    let log: string[] = [];

    const iter = (await subscribe({
      schema,
      document: query,
      contextValue: {
        Poll,
        pubsub,
        log: (info: GraphQLResolveInfo) => log.push(stringPath(info.path)),
        logSub: () => {},
      },
    })) as AsyncIterableIterator<ExecutionResult>;

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [],
        },
      }
    `);

    await execute({
      schema,
      document: gql`
        mutation create {
          createPoll(question: "q1", answers: ["a1", "a2"]) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "answers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 0,
                },
              ],
              "id": "1",
            },
          ],
        },
      }
    `);

    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls",
        "polls",
        "polls.0.id",
        "polls.0.answers",
        "polls.0.answers.0.count",
        "polls.0.answers.1.count",
      ]
    `);
    log = [];

    await execute({
      schema,
      document: gql`
        mutation answer {
          answerPoll(id: 1, answer: 2) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "answers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 1,
                },
              ],
              "id": "1",
            },
          ],
        },
      }
    `);

    // Expect only affected poll field to refetch
    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls.0.id",
        "polls.0.answers",
        "polls.0.answers.0.count",
        "polls.0.answers.1.count",
      ]
    `);

    log = [];

    await execute({
      schema,
      document: gql`
        mutation answer {
          answerPoll(id: 1, answer: 2, skipPollPublish: true) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "answers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 2,
                },
              ],
              "id": "1",
            },
          ],
        },
      }
    `);

    // Expect only affected poll field to refetch
    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls.0.answers",
        "polls.0.answers.0.count",
        "polls.0.answers.1.count",
      ]
    `);

    log = [];

    await execute({
      schema,
      document: gql`
        mutation create {
          createPoll(question: "q2", answers: ["a3", "a4"]) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "answers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 2,
                },
              ],
              "id": "1",
            },
            Object {
              "answers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 0,
                },
              ],
              "id": "2",
            },
          ],
        },
      }
    `);

    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls",
        "polls.0.id",
        "polls.0.answers",
        "polls.0.answers.0.count",
        "polls.0.answers.1.count",
        "polls.1.id",
        "polls.1.answers",
        "polls.1.answers.0.count",
        "polls.1.answers.1.count",
      ]
    `);

    log = [];
  });

  it('refetchable field', async () => {
    Poll.reset();

    const query = gql`
      subscription subscribe {
        polls {
          refetchableAnswers {
            count
          }
        }
      }
    `;

    const pubsub = new PubSub();

    let log: string[] = [];

    const iter = (await subscribe({
      schema,
      document: query,
      contextValue: {
        Poll,
        pubsub,
        log: (info: GraphQLResolveInfo) => log.push(stringPath(info.path)),
        logSub: () => {},
      },
    })) as AsyncIterableIterator<ExecutionResult>;

    await execute({
      schema,
      document: gql`
        mutation create {
          createPoll(question: "q1", answers: ["a1", "a2"]) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "refetchableAnswers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 0,
                },
              ],
            },
          ],
        },
      }
    `);

    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls",
        "polls.0.refetchableAnswers",
        "polls.0.refetchableAnswers.0.count",
        "polls.0.refetchableAnswers.1.count",
      ]
    `);

    await execute({
      schema,
      document: gql`
        mutation answer {
          answerPoll(id: 1, answer: 2, skipPollPublish: true) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    // eslint-disable-next-line require-atomic-updates
    log = [];

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "refetchableAnswers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 1,
                },
              ],
            },
          ],
        },
      }
    `);

    // Expect only affected poll field to refetch
    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls.0.refetchableAnswers.1.count",
      ]
    `);

    log = [];

    await execute({
      schema,
      document: gql`
        mutation create {
          createPoll(question: "q2", answers: ["a3", "a4"]) {
            id
          }
        }
      `,
      contextValue: {
        Poll,
        pubsub,
        log: () => {},
      },
    });

    expect((await iter.next()).value).toMatchInlineSnapshot(`
      Object {
        "data": Object {
          "polls": Array [
            Object {
              "refetchableAnswers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 1,
                },
              ],
            },
            Object {
              "refetchableAnswers": Array [
                Object {
                  "count": 0,
                },
                Object {
                  "count": 0,
                },
              ],
            },
          ],
        },
      }
    `);

    expect(log).toMatchInlineSnapshot(`
      Array [
        "polls",
        "polls.0.refetchableAnswers",
        "polls.0.refetchableAnswers.0.count",
        "polls.0.refetchableAnswers.1.count",
        "polls.1.refetchableAnswers",
        "polls.1.refetchableAnswers.0.count",
        "polls.1.refetchableAnswers.1.count",
      ]
    `);

    log = [];
  });
});
