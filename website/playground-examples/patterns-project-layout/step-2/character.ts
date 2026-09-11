import { builder } from './builder';
import { Characters, type ICharacter, Races } from './data';
import { Race } from './race';

export const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    race: t.field({ type: Race, resolve: (c) => Races.get(c.raceId)! }),
  }),
});

builder.queryFields((t) => ({
  characters: t.field({
    type: [Character],
    resolve: () => Characters,
  }),
}));
