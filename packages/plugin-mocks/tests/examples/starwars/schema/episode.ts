import { builder } from '../builder';

const OriginalEpisodes = {
  NEWHOPE: { description: 'Released in 1977.', value: 4 },
  EMPIRE: { description: 'Released in 1980.', value: 5 },
  JEDI: { description: 'Released in 1983', value: 6 },
};

export const Episode = builder.enumType('Episode', {
  description: 'One of the films in the Star Wars Trilogy',
  values: OriginalEpisodes,
});
