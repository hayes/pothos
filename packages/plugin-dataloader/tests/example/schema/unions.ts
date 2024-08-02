import builder from '../builder';
import type { ContextType } from '../types';
import { countCall, petCounts } from './counts';
import { type Cat, CatObject, type Dog, DogObject } from './interfaces';

const Pet = builder.loadableUnion('Pet', {
  types: [CatObject, DogObject],
  load: (ids: number[], ctx: ContextType) => {
    countCall(ctx, petCounts, ids.length);

    return Promise.resolve<(Cat | Dog)[]>(
      ids.map((id) =>
        id % 2
          ? { type: 'Cat', chasingMouse: !((id % 4) % 2) }
          : { type: 'Dog', chasingTail: !((id % 4) % 2) },
      ),
    );
  },
  resolveType(obj) {
    if (obj.type === 'Cat') {
      return CatObject;
    }

    return DogObject;
  },
});

builder.queryField('pets', (t) =>
  t.field({
    type: [Pet],
    args: {
      ids: t.arg.idList({
        required: true,
      }),
    },
    resolve: (_root, args) => args.ids.map((id) => Number.parseInt(String(id), 10)),
  }),
);
