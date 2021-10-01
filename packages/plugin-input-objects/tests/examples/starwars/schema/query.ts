import builder from '../builder';
import { getDroid, getHero, getHuman } from '../data';
import { Episode } from './episode';

builder.queryType({});
builder.mutationType({});

builder
  .withInput2({
    fields: (t) => ({
      id: t.id({
        required: true,
        description: 'id of the character',
      }),
    }),
  })
  .queryField('human2', {
    type: 'Human',
    resolve: (_, args) => getHuman(args.input.id),
  });

builder
  .withInput2({
    fields: (t) => ({
      id: t.id({
        required: true,
        description: 'id of the character',
      }),
    }),
  })
  .mutationField('test', {
    type: 'Human',
    resolve: (_, args) => getHuman(args.input.id),
  });

builder
  .withInput({
    fields: (t) => ({
      id: t.id({
        required: true,
        description: 'id of the character',
      }),
    }),
  })
  .queryField('human', {
    type: 'Human',
    resolve: (_, args) => getHuman(args.input.id),
  });

builder
  .withInput({
    argName: 'options',
    fields: (t) => ({
      episode: t.field({
        type: Episode,
        required: true,
        description:
          'If omitted, returns the hero of the whole saga. If provided, returns the hero of that particular episode.',
      }),
    }),
  })
  .queryField('hero', {
    type: 'Character',
    resolve: (_, { options }) => getHero(options.episode),
  });

builder.queryFields((t) => ({
  r2d2: t.field({
    type: 'Droid',
    resolve: () => getDroid(2001),
  }),
}));
