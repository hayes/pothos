import { type ResolveCursorConnectionArgs, resolveCursorConnection } from '../../../../src';
import builder from '../builder';

const CursorObject = builder.objectRef<{ id: number }>('CursorObject').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

builder.queryField('cursorConnection', (t) =>
  t.connection({
    type: CursorObject,
    resolve: async (_root, args) =>
      resolveCursorConnection(
        {
          defaultSize: 5,
          maxSize: 8,
          args,
          toCursor: (obj) => obj.id.toString(),
        },
        ({ before, after, inverted, limit }: ResolveCursorConnectionArgs) =>
          queryWithCursor(limit, inverted, after, before),
      ),
  }),
);

const objects: { id: number }[] = [];

for (let i = 0; i < 100; i += 1) {
  objects.push({ id: i + 1 });
}

function queryWithCursor(limit: number, inverted: boolean, after?: string, before?: string) {
  const list = objects.filter(({ id }) => {
    if (before && id >= Number.parseInt(before, 10)) {
      return false;
    }
    if (after && id <= Number.parseInt(after, 10)) {
      return false;
    }

    return true;
  });

  return (inverted ? list.reverse() : list).slice(0, limit);
}
