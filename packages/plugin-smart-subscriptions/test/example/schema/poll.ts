/* eslint-disable no-console */
import builder from '../builder';
import { Poll } from '../data';

const POLLS = 'polls';

builder.objectType('Poll', {
  subscribe: (subscriptions, poll, context) => {
    console.log('subscribing to poll', poll.id);
    subscriptions.register(`poll/${poll.id}`, {
      refetch: (): Promise<Poll> => {
        console.log('reFetching poll', poll.id);
        return new Promise<Poll>((resolve) => {
          setTimeout(() => resolve(context.Poll.map.get(poll.id)!), 1000);
        });
      },
    });
  },
  fields: (t) => ({
    id: t.exposeID('id', {}),
    updatedAt: t.string({
      resolve: () => new Date().toISOString(),
    }),
    question: t.exposeString('question', {}),
    answers: t.field({
      nullable: true,
      type: ['Answer'],
      resolve: (parent, args, context, info) => {
        console.log(info.operation.name?.value, 'fetching answer for poll', parent.id);

        return parent.answers;
      },
    }),
  }),
});

builder.objectType('Answer', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    value: t.exposeString('value', {}),
    count: t.exposeInt('count', {
      subscribe: (subscriptions, parent, args) => {
        subscriptions.register(`poll-result/${parent.id}`);
      },
      // canRefetch: true,
    }),
  }),
});

builder.queryFields((t) => ({
  polls: t.field({
    type: ['Poll'],
    smartSubscription: true,
    subscribe: (subscriptions) => subscriptions.register('polls'),
    resolve: (root, args, ctx, info) => {
      console.log(info.operation.name?.value, 'fetching all polls');

      return [...Poll.map.values()];
    },
  }),
  poll: t.field({
    type: 'Poll',
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    smartSubscription: true,
    resolve: (root, args, ctx, info) => {
      console.log(info.operation.name?.value, 'fetching poll', args.id);

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
    resolve: (root, args, { pubsub }) => {
      const poll = Poll.create(args.question, args.answers);

      pubsub.publish(POLLS, poll.id);

      return poll;
    },
  }),
  answerPoll: t.field({
    type: 'Poll',
    args: {
      id: t.arg.id({ required: true }),
      answer: t.arg.int({ required: true }),
      skipPollPublish: t.arg.bool({ required: false }),
    },
    resolve: (root, args, { pubsub }, info) => {
      console.log(info.operation.name?.value, 'answering poll', args.id, 'with', args.answer);

      const poll = Poll.map.get(Number(args.id));

      if (!poll) {
        throw new Error(`Poll ${args.id} not found`);
      }

      const answer = poll.answers.find((a) => a.id === args.answer);

      if (!answer) {
        throw new Error(`Invalid answer for poll ${args.id}`);
      }

      answer.count += 1;

      if (!args.skipPollPublish) {
        pubsub.publish(`poll/${args.id}`, {});
      }

      pubsub.publish(`poll-result/${args.answer}`, {});

      return poll;
    },
  }),
}));
