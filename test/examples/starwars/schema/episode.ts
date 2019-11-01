import builder from '../builder';

const OriginalEpisodes = {
  NEWHOPE: { description: 'Released in 1977.' },
  EMPIRE: { description: 'Released in 1980.' },
  JEDI: { description: 'Released in 1983' },
};

export function episodeFromID(id: number) {
  switch (id) {
    case 4:
      return 'NEWHOPE';
    case 5:
      return 'EMPIRE';
    case 6:
      return 'JEDI';
    default:
      throw new Error(`Episode ${id} not found`);
  }
}

export const Episode = builder.createEnumType('Episode', {
  description: 'One of the films in the Star Wars Trilogy',
  values: OriginalEpisodes,
});

export const MoreEpisodes = builder.createEnumType('MoreEpisode', {
  values: { ...OriginalEpisodes, OTHER: {} },
});
