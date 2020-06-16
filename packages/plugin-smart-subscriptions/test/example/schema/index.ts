import './poll';
import builder from '../builder';

builder.queryType({ fields: (t) => ({}) });
builder.mutationType({ fields: (t) => ({}) });
builder.subscriptionType({
  fields: (t) => ({
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
