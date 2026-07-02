import SchemaBuilder from '@pothos/core';

interface IFellowship {
  id: number;
  name: string;
  leaderId: number;
}

const Fellowships = new Map<number, IFellowship>([
  [1, { id: 1, name: 'Fellowship of the Ring', leaderId: 1 }],
]);

interface Context {
  user?: { id: number };
}

const builder = new SchemaBuilder<{
  Context: Context;
}>({});

const Fellowship = builder.objectRef<IFellowship>('Fellowship');

Fellowship.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    fellowships: t.field({
      type: [Fellowship],
      resolve: () => [...Fellowships.values()],
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    renameFellowship: t.field({
      type: Fellowship,
      args: {
        input: t.arg({
          type: builder.inputType('RenameFellowshipInput', {
            fields: (t) => ({
              fellowshipId: t.id({ required: true }),
              name: t.string({ required: true }),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }, ctx) => {
        if (!ctx.user) {
          throw new Error('Not signed in');
        }
        const fellowship = Fellowships.get(Number(input.fellowshipId));
        if (!fellowship) {
          throw new Error(`No fellowship with id ${input.fellowshipId}`);
        }
        if (fellowship.leaderId !== ctx.user.id) {
          throw new Error('Only the leader can rename the fellowship');
        }
        fellowship.name = input.name;
        return fellowship;
      },
    }),
  }),
});

export const schema = builder.toSchema();
