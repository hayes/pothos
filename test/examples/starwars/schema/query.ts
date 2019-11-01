import builder from '../builder';
import { getHero, getHuman, getDroid } from '../data';
import { Episode } from './episode';

const characterArgs = {
  id: {
    type: 'ID' as const,
    required: true as const,
    description: 'id of the character',
  },
};

export default builder.createObjectType('Query', {
  shape: t => ({
    hero: t.field({
      type: 'Character',
      args: {
        episode: {
          type: Episode,
          description:
            'If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.',
        },
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
