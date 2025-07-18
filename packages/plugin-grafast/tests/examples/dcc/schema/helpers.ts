import { context, each, get, inhibitOnNull, loadMany, loadOne, Maybe, type Step } from 'grafast';
import {
  batchGetCrawlerById,
  type NpcData,
  type CrawlerData,
  type FloorData,
  type ItemSpec,
  type ItemType,
  batchGetLootDataByItemTypeAndId,
  batchGetLootBoxById,
} from '../data';

export function getCreator($source: Step<{ creator?: number }>) {
  const $db = context().get('dccDb');
  const $id = inhibitOnNull(get($source, 'creator'));
  return loadOne($id, $db, null, batchGetCrawlerById);
}

export function crawlerToTypeName(crawler: CrawlerData): string | null {
  if (crawler.deleted) {
    return 'DeletedCrawler';
  }

  return 'ActiveCrawler';
}

export function npcToTypeName(npc: NpcData): string | null {
  if (!npc) {
    return null;
  }

  if (['Manager', 'Security', 'Guide', 'Staff'].includes(npc.type)) {
    return npc.type;
  }

  console.warn(`${npc.type} is not yet a supported type of NPC in GraphQL`);
  return null;
}

export function extractCrawlerId(id: number) {
  if (id > 100 && id < 200) {
    return id;
  }

  return null;
}

export function extractNpcId(id: number) {
  if (id > 300 && id < 400) {
    return id;
  }

  return null;
}

export function decodeItemSpec(itemSpec: ItemSpec): {
  __typename: string;
  id: number;
} {
  const [__typename, rawID] = itemSpec.split(':');
  const id = Number.parseInt(rawID, 10);
  return { __typename, id };
}

export function encodeItemSpec([type, id]: readonly [type: ItemType, id: number]): ItemSpec {
  return `${type}:${id}`;
}

export function getFloor(number: number): FloorData | null {
  if (number >= 1 && number <= 18) {
    return { number };
  }
  return null;
}

export function applyLimit<T>([list, count]: readonly [T[] | null | undefined, Maybe<number>]) {
  if (list == null) {
    return list;
  }
  if (count != null) {
    return list.slice(0, count);
  }
  return list;
}

export function lootBoxesForItem($type: Step<string>, $id: Step<number>) {
  const $db = context().get('dccDb');

  const $lootData = inhibitOnNull(
    loadMany([$type, $id], $db, null, batchGetLootDataByItemTypeAndId),
  );
  return each($lootData, ($lootDatum) => {
    const $db = context().get('dccDb');

    return loadOne(get($lootDatum, 'lootBoxId'), $db, null, batchGetLootBoxById);
  });
}
