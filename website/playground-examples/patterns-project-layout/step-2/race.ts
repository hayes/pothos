import { builder } from './builder';
import { type IRace, Races } from './data';

// Per-domain modules own the type, its fields, and the query entry
// points that return it. Cross-domain links live in the file that
// reaches into other domains (here: character.ts).
export const Race = builder.objectRef<IRace>('Race').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryFields((t) => ({
  races: t.field({
    type: [Race],
    resolve: () => [...Races.values()],
  }),
}));
