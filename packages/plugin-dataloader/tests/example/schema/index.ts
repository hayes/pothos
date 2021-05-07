import builder from '../builder';

const OtherObj = builder.objectRef<{ abc: number }>('Other').implement({
  fields: (t) => ({
    test: t.boolean({
      resolve: (parent) => true,
    }),
  }),
});

const Test = builder.loadableObject('Test', {
  load: async (keys: string[]) => Promise.resolve([{ test: true }]),
  fields: (t) => ({
    test: t.boolean({
      resolve: (parent) => parent.test,
    }),
  }),
});

builder.queryField('example', (t) =>
  t.loadable({
    type: [OtherObj],
    //  keys type inferred from resolve return (will always be an array, even if its for a non-list field)
    load: (keys) => Promise.resolve(keys.map((key) => ({ abc: key }))),
    resolve: () => [123],
  }),
);

builder.queryType({
  fields: (t) => ({
    useTest: t.field({
      type: [Test],
      resolve: () => [
        'abc', // loaded through dataloader, returned (string, number, bigint are assumed to be keys for dataloader)
        { test: false }, // loaded manually.
        // @ts-expect-error because {test: 123} does not match the inferred shape of { test:boolean }
        { test: 123 },
      ],
    }),
  }),
});

export default builder.toSchema({});
