/* eslint-disable */
import { resolveOffsetConnection, resolveArrayConnection } from '../../../../src';
import builder from '../builder';

builder.objectType('Poll', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    updatedAt: t.string({
      resolve: () => new Date().toISOString(),
    }),
    question: t.exposeString('question', {}),
    answers: t.expose('answers', {
      type: ['Answer'],
    }),
    answersConnection: t.connection(
      {
        type: 'Answer',
        // args automatically gets default cursor pagination args, but you can add more args like any other field
        resolve: (parent, args) => {
          // This would be for simple cases where you already have all the data
          return resolveArrayConnection({ args }, parent.answers);
        },
      },
      {},
      {},
    ),
    answersUsingOffset: t.connection(
      {
        type: 'Answer',
        resolve: (parent, args) => {
          // This would be the API for limit/offset based APIs
          return resolveOffsetConnection({ args }, ({ limit, offset }) => {
            // replace with call to limit/offset based service
            return parent.answers.slice(offset, offset + limit);
          });
        },
      },
      {},
      {},
    ),
    answersWithoutHelpers: t.connection(
      {
        type: 'Answer',
        resolve: (parent, args) => {
          // If you don't have a helper, this is the shape you are expected to return
          return {
            pageInfo: {
              hasNextPage: false,
              hasPreviousPage: false,
              startCursor: 'abc',
              endCursor: 'def',
            },
            edges: [
              {
                cursor: 'xyz',
                node: parent.answers[0],
              },
            ],
          };
        },
      },
      {
        // Name for the Connection object
        name: 'PollAnswersCon', // optional, will use ParentObject + capitalize(FieldName) + "Connection" as the default
        fields: () => ({
          /* define extra fields on Connection */
        }),
        // Other options like auth would go into this object as well
      },
      {
        // Same as above, but for the Edge Object
        name: 'PollAnswersConEdge', // optional, will use Connection name + "Edge" as the default
        fields: () => ({
          /* define extra fields on Edge */
        }),
      },
    ),
  }),
});

builder.objectType('Answer', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    value: t.exposeString('value', {}),
    count: t.exposeInt('count', {}),
  }),
});

builder.queryField('pollsConnection', (t) =>
  t.connection(
    {
      type: 'Poll',
      resolve: async (root, args, { Poll: PollList }) => {
        return {
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
          },
          edges: [...PollList.map.values()].map((node) => ({
            cursor: String(node.id),
            extra: 1,
            node,
          })),
          extra: 'abc',
        };
      },
    },
    {
      name: 'QueryPollsConnection',
      fields: (t) => ({
        extraConnectionField: t.string({
          resolve: (parent) => parent.extra,
        }),
      }),
    },
    {
      name: 'QueryPollsConnectionEdge',
      fields: (t) => ({
        extraEdgeField: t.int({
          resolve: (parent) => parent.extra,
        }),
      }),
    },
  ),
);

builder.queryFields((t) => ({
  polls: t.field({
    type: ['Poll'],
    resolve: (root, args, { Poll }, info) => {
      return [...Poll.map.values()];
    },
  }),
  poll: t.field({
    type: 'Poll',
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: (root, args, { Poll }, info) => {
      return Poll.map.get(args.id);
    },
  }),
}));

builder.mutationFields((t) => ({
  createPoll: t.field({
    type: 'Poll',
    args: {
      question: t.arg.string({ required: true }),
      answers: t.arg.stringList({ required: true }),
    },
    resolve: (root, args, { Poll, pubsub }) => {
      const poll = Poll.create(args.question, args.answers);

      return poll;
    },
  }),
  answerPoll: t.field({
    type: 'Poll',
    args: {
      id: t.arg.id({ required: true }),
      answer: t.arg.int({ required: true }),
    },
    resolve: (root, args, { Poll, pubsub }, info) => {
      const poll = Poll.map.get(Number(args.id));

      if (!poll) {
        throw new Error(`Poll ${args.id} not found`);
      }

      const answer = poll.answers.find((a) => a.id === args.answer);

      if (!answer) {
        throw new Error(`Invalid answer for poll ${args.id}`);
      }

      answer.count += 1;

      return poll;
    },
  }),
}));
