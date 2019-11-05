import builder from '../builder';
import { getHero, getHuman, getDroid } from '../data';
import { Episode } from './episode';

const characterArgs = builder.createArgs(t => ({
  id: t.id({
    required: true,
    description: 'id of the character',
  }),
}));

export default builder.createObjectType('Query', {
  shape: t => ({
    hero: t.field({
      type: 'Character',
      args: {
        episode: t.arg(Episode, {
          description:
            'If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.',
        }),
      },
      resolve: (_, { episode }) => getHero(episode),
    }),
    human: t.field({
      type: 'Human',
      args: characterArgs,
      resolve: (_, { id }) => getHuman(id),
    }),
    droid: t.field({
      type: 'Droid',
      args: characterArgs,
      resolve: (_, { id }) => getDroid(id),
    }),
  }),
});
