import { constant, context, lambda, loadOne } from 'grafast';
import { builder } from '../builder';
import { batchGetCrawlerById, type FloorData, type ItemSpec } from '../data';
import { Character, Crawler, NPC } from './characters';
import { Item } from './items';
import { Floor } from './location';

builder.queryType({
  fields: (t) => ({
    crawler: t.field({
      type: Crawler,
      args: {
        id: t.arg.int({ required: true }),
      },
      plan: (_, { $id }) => {
        const $db = context().get('dccDb');
        return loadOne($id, $db, null, batchGetCrawlerById);
      },
    }),
    character: t.field({
      type: Character,
      args: {
        id: t.arg.int({ required: true }),
      },
      plan: (_, { $id }) => {
        return $id;
      },
    }),
    npc: t.field({
      type: NPC,
      args: {
        id: t.arg.int({ required: true }),
      },
      plan: (_, { $id }) => {
        return $id;
      },
    }),
    floor: t.field({
      type: Floor,
      args: {
        number: t.arg.int({ required: true }),
      },
      plan: (_, { $number }) => {
        return lambda($number, getFloor);
      },
    }),
    item: t.field({
      type: Item,
      args: {
        type: t.arg.string({ required: true }),
        id: t.arg.int({ required: true }),
      },
      plan: (_, { $type, $id }) => {
        return lambda([$type, $id], ([type, id]) => `${type}:${id}` as ItemSpec);
      },
    }),
    brokenItem: t.field({
      type: Item,
      plan: () => {
        return constant('Utility:999' as ItemSpec);
      },
    }),
  }),
});

function getFloor(number: number): FloorData | null {
  if (number >= 1 && number <= 18) {
    return { number };
  }
  return null;
}
