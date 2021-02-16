import builder from '../builder';
import { getDroid,getHero, getHuman } from '../data';
import { Episode } from './episode';

const characterArgs = builder.args((t) => ({
  id: t.id({
    required: true,
    description: 'id of the character',
  }),
}));

builder.queryType({
  subGraphs: ['Public', 'Private'],
  defaultSubGraphsForFields: ['Private'],
  fields: (t) => ({
    hero: t.field({
      type: 'Character',
      args: {
        episode: t.arg({
          type: Episode,
          required: true,
          description:
            'If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.',
        }),
      },
      resolve: (_, { episode }) => getHero(episode),
    }),
    human: t.field({
      subGraphs: ['Public', 'Private'],
      type: 'Human',
      args: characterArgs,
      resolve: (_, { id }) => getHuman(id),
    }),
    droid: t.field({
      subGraphs: ['Public', 'Private'],
      type: 'Droid',
      args: characterArgs,
      resolve: (_, { id }) => getDroid(id),
    }),
  }),
});

builder.queryFields((t) => ({
  r2d2: t.field({
    subGraphs: ['Public'],
    type: 'Droid',
    resolve: () => getDroid(2001),
  }),
}));
