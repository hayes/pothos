import './poll';
import builder from '../builder';

builder.queryType({ fields: () => ({}) });
builder.mutationType({ fields: () => ({}) });
builder.subscriptionType({
  fields: (t) => ({
    test: t.int({
      resolve: (parent) => parent,
      subscribe: () => {
        let i = 0;
        const iter = {
          next: () =>
            new Promise<IteratorResult<number, never>>((resolve) => {
              setTimeout(() => {
                resolve({
                  // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
                  value: (i += 1),
                  done: false,
                });
              }, 1000);
            }),
        };

        return { [Symbol.asyncIterator]: () => iter };
      },
    }),
  }),
});

export default builder.toSchema();
