import builder from '../builder';

const POLLS = 'polls';

builder.objectType('Poll', {
  subscribe: (subscriptions, parent, context) => {
    subscriptions.register(`poll/${parent.id}`, {
      filter: () => {
        return true;
      },
      invalidateCache: () => {},
      refetch: () => {
        return context.Poll.map.get(parent.id)!;
      },
    });
  },
  shape: t => ({
    id: t.exposeID('id', {}),
    updatedAt: t.string({
      resolve: () => new Date().toISOString(),
    }),
    question: t.exposeString('question', {}),
    answers: t.exposeStringList('answers', {}),
    results: t.field({
      type: ['PollResult'],
      resolve: parent => {
        return [...parent.results].map(([answer, count]) => ({
          answer,
          count,
        }));
      },
    }),
  }),
});

builder.objectType('PollResult', {}, t => ({
  answer: t.exposeString('answer', {}),
  count: t.exposeInt('count', {}),
}));

builder.queryFields(t => ({
  polls: t.field({
    type: ['Poll'],
    smartSubscription: true,
    subscribe: subscriptions => subscriptions.register('polls'),
    resolve: (root, args, { Poll }) => {
      console.log('getting polls');

      return [...Poll.map.values()];
    },
  }),
  poll: t.field({
    type: 'Poll',
    smartSubscription: true,
    nullable: true,
    args: {
      id: t.arg.int({ required: true }),
    },
    resolve: (root, args, { Poll }) => {
      console.log('getting poll', args.id);

      return Poll.map.get(args.id);
    },
  }),
}));

builder.mutationFields(t => ({
  createPoll: t.field({
    type: 'Poll',
    args: {
      question: t.arg.string({ required: true }),
      answers: t.arg.stringList({ required: true }),
    },
    resolve: (root, args, { Poll, pubsub }) => {
      const poll = Poll.create(args.question, args.answers);

      pubsub.publish(POLLS, poll.id);

      return poll;
    },
  }),
  answerPoll: t.field({
    type: 'Poll',
    args: {
      id: t.arg.id({ required: true }),
      answer: t.arg.string({ required: true }),
    },
    resolve: (root, args, { Poll, pubsub }) => {
      const poll = Poll.map.get(Number(args.id));

      if (!poll) {
        throw new Error(`Poll ${args.id} not found`);
      }

      if (!poll.results.has(args.answer)) {
        throw new Error(`Invalid answer for poll ${args.id}`);
      }

      poll.results.set(args.answer, poll.results.get(args.answer)! + 1);

      pubsub.publish(`poll/${args.id}`, {});

      return poll;
    },
  }),
}));
