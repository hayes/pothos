import './poll';
import builder from '../builder';

builder.queryType({ shape: (t) => ({}) });
builder.mutationType({ shape: (t) => ({}) });
builder.subscriptionType({
  shape: (t) => ({
    test: t.int({
      resolve: (parent) => parent,
      subscribe: () => {
        let i = 0;
        const iter = {
          next: () =>
            new Promise<IteratorResult<number, never>>((resolve) =>
              setTimeout(() => {
                resolve({
                  value: i += 1,
                  done: false,
                });
              }),
            ),
        };

        return { [Symbol.asyncIterator]: () => iter };
      },
    }),
  }),
});

export default builder.toSchema();
