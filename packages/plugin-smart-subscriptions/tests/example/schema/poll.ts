import builder from '../builder';
import { Poll } from '../data';

const POLLS = 'polls';

builder.objectType('Poll', {
  subscribe: (subscriptions, poll, context) => {
    context.logSub('subscribe', `poll ${poll.id}`);
    subscriptions.register(`poll/${poll.id}`, {
      refetch: (): Promise<Poll> => {
        context.logSub('re-fetch', `poll ${poll.id}`);

        return new Promise<Poll>((resolve) => {
          setTimeout(() => void resolve(context.Poll.map.get(poll.id)!), 1000);
        });
      },
    });
  },
  fields: (t) => ({
    id: t.id({
      resolve: (poll, args, ctx, info) => {
        ctx.log(info);

        return poll.id;
      },
    }),
    updatedAt: t.string({
      resolve: () => new Date().toISOString(),
    }),
    question: t.exposeString('question', {}),
    answers: t.field({
      nullable: true,
      type: ['Answer'],
      canRefetch: true,
      resolve: (parent, args, context, info) => {
        context.log(info);

        return parent.answers;
      },
    }),
    refetchableAnswers: t.field({
      nullable: true,
      type: ['RefetchableAnswer'],
      resolve: (parent, args, context, info) => {
        context.log(info);

        return parent.answers;
      },
    }),
  }),
});

builder.objectType('Answer', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    value: t.exposeString('value', {}),
    count: t.int({
      subscribe: (subscriptions, parent, args, context) => {
        context.logSub('subscribe', `poll-result/${parent.id}`);

        subscriptions.register(`poll-result/${parent.id}`);
      },
      resolve: (parent, args, ctx, info) => {
        ctx.log(info);

        return parent.count;
      },
    }),
  }),
});

builder.objectType('RefetchableAnswer', {
  fields: (t) => ({
    id: t.exposeID('id', {}),
    value: t.exposeString('value', {}),
    count: t.int({
      subscribe: (subscriptions, parent, args, context) => {
        context.logSub('subscribe', `poll-result/${parent.id}`);

        subscriptions.register(`poll-result/${parent.id}`);
      },
      resolve: (parent, args, ctx, info) => {
        ctx.log(info);

        return parent.count;
      },
      canRefetch: true,
    }),
  }),
});

builder.queryFields((t) => ({
  polls: t.field({
    type: ['Poll'],
    smartSubscription: true,
    subscribe: (subscriptions) => void subscriptions.register('polls'),
    resolve: (root, args, ctx, info) => {
      ctx.log(info);

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
      ctx.log(info);

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
    resolve: async (root, args, { pubsub }) => {
      const poll = Poll.create(args.question, args.answers);

      await pubsub.publish(POLLS, poll.id);

      return poll;
    },
  }),
  answerPoll: t.field({
    type: 'Poll',
    args: {
      id: t.arg.id({ required: true }),
      answer: t.arg.int({ required: true }),
      skipPollPublish: t.arg.boolean({ required: false }),
    },
    resolve: async (root, args, { pubsub, log }, info) => {
      log(info);

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
        await pubsub.publish(`poll/${args.id}`, {});
      }

      await pubsub.publish(`poll-result/${args.answer}`, {});

      return poll;
    },
  }),
}));
