import {
  coalesce,
  each,
  get,
  type InterfacePlan,
  inhibitOnNull,
  lambda,
  loadOne,
  type Step,
} from 'grafast';
import { builder } from '../builder';
import {
  batchGetCrawlerById,
  batchGetNpcById,
  type CrawlerData,
  type ItemSpec,
  type NpcData,
} from '../data';
import { Species } from './enums';
import {
  applyLimit,
  crawlerToTypeName,
  extractCrawlerId,
  extractNpcId,
  npcToTypeName,
} from './helpers';
import { HasInventory, Item } from './items';

const characterPlan = (($specifier) => {
  const $crawlerId = inhibitOnNull(lambda($specifier, extractCrawlerId));
  const $crawler = inhibitOnNull(loadOne($crawlerId, batchGetCrawlerById));
  const $crawlerTypename = lambda($crawler, crawlerToTypeName);

  const $npcId = inhibitOnNull(lambda($specifier, extractNpcId));
  const $npc = inhibitOnNull(loadOne($npcId, batchGetNpcById));
  const $npcTypename = lambda($npc, npcToTypeName);

  const $__typename = coalesce([$crawlerTypename, $npcTypename]);

  return {
    $__typename,
    planForType: (t) => {
      if (t.getInterfaces().some((iface) => iface.name === 'Crawler')) {
        return $crawler;
      }

      if (t.getInterfaces().some((iface) => iface.name === 'NPC')) {
        return $npc;
      }

      return null;
    },
  };
}) satisfies InterfacePlan<Step<CharacterData>, Step<number>>['planType'];

export const Character = builder
  .interfaceRef<{
    id: number;
    name: string;
  }>('Character')
  .withPlan({ planType: characterPlan })
  .implement({
    fields: (t) => ({
      id: t.exposeID('id', {
        nullable: false,
      }),
      name: t.exposeString('name', {
        nullable: false,
      }),
    }),
  });

export const NPC = builder
  .interfaceRef<NpcData>('NPC')
  .implement({
    interfaces: [Character],
    fields: (t) => ({
      species: t.expose('species', {
        type: Species,
      }),
      exCrawler: t.exposeBoolean('exCrawler'),
      bestFriend: t.field({
        type: Character,
        plan: ($npc) => {
          return get($npc, 'bestFriend') as Step<number | undefined>;
        },
      }),
      friends: t.field({
        type: [Character],
        args: {
          first: t.arg.int(),
        },
        plan: (npc, { $first }) => {
          const $friends = get(npc, 'friends') as Step<number[]>;
          return lambda([$friends, $first], applyLimit);
        },
      }),
    }),
  })
  .withPlan<number>({
    planType: ($npcId) => {
      const $npc = inhibitOnNull(loadOne($npcId, batchGetNpcById));
      const $__typename = lambda(inhibitOnNull($npc), npcToTypeName);

      return {
        $__typename,
        planForType() {
          return $npc;
        },
      };
    },
  });

export const Guide = builder.objectRef<NpcData>('Guide').implement({
  interfaces: [NPC, Character],
  fields: (t) => ({
    saferoomLocation: t.string({
      resolve: () => null,
    }),
  }),
});

export const Manager = builder.objectRef<NpcData>('Manager').implement({
  interfaces: [NPC, Character, HasInventory],
  fields: (t) => ({
    client: t.field({
      type: ActiveCrawler,
      plan: ($manager) => {
        const $id = inhibitOnNull(get($manager, 'client') as Step<number>);
        return loadOne($id, batchGetCrawlerById);
      },
    }),
    items: t.field({
      type: [Item],
      args: {
        first: t.arg.int(),
      },
      plan: ($manager, { $first }) => {
        const $items = get($manager, 'items') as Step<ItemSpec[]>;
        return lambda([$items, $first], applyLimit);
      },
    }),
  }),
});

export const Security = builder.objectRef<NpcData>('Security').implement({
  interfaces: [NPC, Character],
  fields: (t) => ({
    clients: t.field({
      type: [Character],
      plan: ($security) => {
        const $ids = inhibitOnNull(get($security, 'clients') as Step<number[]>);
        return each($ids, ($id) => {
          return loadOne($id, batchGetCrawlerById);
        });
      },
    }),
  }),
});

export const Staff = builder.objectRef<NpcData>('Staff').implement({
  interfaces: [NPC, Character, HasInventory],
  fields: (t) => ({
    items: t.field({
      type: [Item],
      args: {
        first: t.arg.int(),
      },
      plan: ($staff, { $first }) => {
        const $items = get($staff, 'items') as Step<ItemSpec[]>;
        return lambda([$items, $first], applyLimit);
      },
    }),
  }),
});

export const Crawler = builder
  .interfaceRef<CrawlerData>('Crawler')
  .withPlan({
    planType: ($crawler) => {
      const $__typename = lambda($crawler, crawlerToTypeName);
      return { $__typename, planForType: () => $crawler };
    },
  })
  .implement({
    interfaces: [Character],
    fields: (t) => ({
      crawlerNumber: t.exposeInt('crawlerNumber'),
    }),
  });

export const DeletedCrawler = builder.objectRef<CrawlerData>('DeletedCrawler').implement({
  interfaces: [Crawler, Character],
});

export const ActiveCrawler = builder.objectRef<CrawlerData>('ActiveCrawler').implement({
  interfaces: [Crawler, Character, HasInventory],
  fields: (t) => ({
    friends: t.field({
      type: [Character],
      args: {
        first: t.arg.int(),
      },
      plan: ($activeCrawler, { $first }) => {
        const $ids = get($activeCrawler, 'friends') as Step<number[]>;
        return lambda([$ids, $first], applyLimit);
      },
    }),
    items: t.field({
      type: [Item],
      args: {
        first: t.arg.int(),
      },
      plan: ($activeCrawler, { $first }) => {
        const $items = get($activeCrawler, 'items') as Step<ItemSpec[]>;
        return lambda([$items, $first], applyLimit);
      },
    }),
    favouriteItem: t.expose('favouriteItem', {
      type: Item,
    }),
  }),
});

builder.objectFields(ActiveCrawler, (t) => ({
  bestFriend: t.field({
    type: ActiveCrawler,
    plan: ($activeCrawler) => {
      const $id = inhibitOnNull(get($activeCrawler, 'bestFriend') as Step<number | undefined>);
      return loadOne($id, batchGetCrawlerById);
    },
  }),
}));
