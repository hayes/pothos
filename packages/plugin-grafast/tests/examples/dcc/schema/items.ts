import {
  constant,
  context,
  each,
  get,
  inhibitOnNull,
  type InterfacePlan,
  lambda,
  loadMany,
  loadOne,
  type Step,
} from 'grafast';
import { builder } from '../builder';
import {
  batchGetConsumableById,
  batchGetCrawlerById,
  batchGetEquipmentById,
  batchGetLootDataByLootBoxId,
  batchGetMiscItemById,
  batchGetUtilityItemById,
  type ConsumableData,
  type ItemData,
  type ItemSpec,
  type LootBoxData,
  type LootDataData,
} from '../data';
import { Crawler } from './characters';
import { decodeItemSpec, encodeItemSpec, lootBoxesForItem } from './helpers';

export const ItemResolver = {
  planType($itemSpec) {
    const $decoded = lambda($itemSpec, decodeItemSpec);
    const $__typename = get($decoded, '__typename');
    return {
      $__typename,
      planForType(t) {
        const $id = get($decoded, 'id');
        const $db = context().get('dccDb');

        if (t.name === 'Equipment') {
          return loadOne($id, $db, null, batchGetEquipmentById);
        }
        if (t.name === 'Consumable') {
          return loadOne($id, $db, null, batchGetConsumableById);
        }
        if (t.name === 'UtilityItem') {
          return loadOne($id, $db, null, batchGetUtilityItemById);
        }
        if (t.name === 'MiscItem') {
          return loadOne($id, $db, null, batchGetMiscItemById);
        }

        return null;
      },
    };
  },
} satisfies InterfacePlan<Step<ItemData>, Step<ItemSpec>>;

export const Item = builder
  .interfaceRef<ItemData>('Item')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id', {
        nullable: false,
      }),
      name: t.exposeString('name'),
      canBeFoundIn: t.field({
        type: [LootBox],
      }),
    }),
  })
  .withPlan(ItemResolver.planType);

export const HasInventory = builder.interfaceRef<{}>('HasInventory').implement({
  fields: (t) => ({
    items: t.field({
      args: {
        first: t.arg.int(),
      },
      type: [Item],
    }),
  }),
});

export const Created = builder.interfaceRef<ItemData>('Created').implement({
  fields: (t) => ({
    creator: t.field({
      type: Crawler,
      plan: ($item) => {
        return getCreator($item);
      },
    }),
  }),
});

export const HasContents = builder.interfaceRef<{}>('HasContents').implement({
  fields: (t) => ({
    contents: t.field({
      args: {
        first: t.arg.int(),
      },
      type: [Item],
    }),
  }),
});

export const Equipment = builder.objectRef<ItemData>('Equipment').implement({
  interfaces: [Item, Created, HasContents],
  fields: (t) => ({
    canBeFoundIn: t.field({
      type: [LootBox],
      plan: ($item) => {
        const $id = get($item, 'id') as Step<number>;
        const $type = constant('Equipment');
        return lootBoxesForItem($type, $id);
      },
    }),
  }),
});

export const Consumable = builder.objectRef<ConsumableData>('Consumable').implement({
  interfaces: [Item, Created, HasContents],
  fields: (t) => ({
    canBeFoundIn: t.field({
      type: [LootBox],
      plan: ($item) => {
        const $id = get($item, 'id') as Step<number>;
        const $type = constant('Consumable');
        return lootBoxesForItem($type, $id);
      },
    }),
    effect: t.exposeString('effect'),
  }),
});

export const MiscItem = builder.objectRef<ItemData>('MiscItem').implement({
  interfaces: [Item, Created, HasContents],
  fields: (t) => ({
    canBeFoundIn: t.field({
      type: [LootBox],
      plan: ($item) => {
        const $id = get($item, 'id') as Step<number>;
        const $type = constant('MiscItem');
        return lootBoxesForItem($type, $id);
      },
    }),
  }),
});

export const UtilityItem = builder.objectRef<ItemData>('UtilityItem').implement({
  interfaces: [Item, Created, HasContents],
  fields: (t) => ({
    canBeFoundIn: t.field({
      type: [LootBox],
      plan: ($item) => {
        const $id = get($item, 'id') as Step<number>;
        const $type = constant('UtilityItem');
        return lootBoxesForItem($type, $id);
      },
    }),
  }),
});

export const LootBox = builder.objectRef<LootBoxData>('LootBox').implement({
  fields: (t) => ({
    id: t.exposeID('id', {
      nullable: false,
    }),
    tier: t.exposeString('tier'),
    category: t.exposeString('category'),
  }),
});

builder.objectFields(LootBox, (t) => ({
  possibleItems: t.field({
    type: [Item],
    plan: ($lootBox) => {
      const $id = get($lootBox, 'id') as Step<number>;
      const $db = context().get('dccDb');

      const $lootData = inhibitOnNull(loadMany($id, $db, null, batchGetLootDataByLootBoxId));

      return each($lootData, ($lootDatum) => {
        const $id = get($lootDatum, 'itemId');
        const $type = get($lootDatum, 'itemType');
        return lambda([$type, $id], encodeItemSpec);
      });
    },
  }),
}));

export const LootData = builder.objectRef<LootDataData>('LootData').implement({
  fields: (t) => ({
    id: t.exposeID('id', {
      nullable: false,
    }),
    itemType: t.exposeString('itemType'),
    itemId: t.exposeID('itemId', {
      nullable: false,
    }),
    lootBoxId: t.exposeID('lootBoxId', {
      nullable: false,
    }),
    percentageChance: t.exposeInt('percentageChance'),
  }),
});

function getCreator($source: Step<{ creator?: number }>) {
  const $db = context().get('dccDb');
  const $id = inhibitOnNull(get($source, 'creator'));
  return loadOne($id, $db, null, batchGetCrawlerById);
}
