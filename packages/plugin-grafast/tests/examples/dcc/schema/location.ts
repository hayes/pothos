import { context, each, get, inhibitOnNull, lambda, loadMany, loadOne, type Step } from 'grafast';
import { builder } from '../builder';
import {
  batchGetClubById,
  batchGetLocationsByFloorNumber,
  batchGetNpcById,
  batchGetSafeRoomById,
  batchGetStairwellById,
  type ClubData,
  type FloorData,
  type LocationData,
  type SafeRoomData,
} from '../data';
import { delegate } from '../delegate';
import { NPC, Security } from './characters';
import { getFloor } from './helpers';
import { Consumable, Equipment, ItemResolver, MiscItem, UtilityItem } from './items';

export const Location = builder.interfaceRef<LocationData>('Location').withPlan({
  planType: ($location) => {
    const $__typename = get($location, 'type');
    return {
      $__typename,
      planForType(t) {
        const $id = get($location, 'id');

        if (t.name === 'SafeRoom') {
          const $saferoom = loadOne($id, batchGetSafeRoomById);
          return delegate($saferoom, ['type', 'name', 'floors', 'id'], $location);
        }
        if (t.name === 'Club') {
          const $club = loadOne($id, batchGetClubById);
          return delegate($club, ['type', 'name', 'floors', 'id'], $location);
        }
        if (t.name === 'Stairwell') {
          const $stairwell = loadOne($id, batchGetStairwellById);
          return delegate($stairwell, ['type', 'name', 'floors', 'id'], $location);
        }
        if (t.name === 'BetaLocation') {
          // This is to check that explicitly returning null here works as expected
          return null;
        }
        return null;
      },
    };
  },
});

Location.implement({
  fields: (t) => ({
    id: t.exposeID('id', {
      nullable: false,
    }),
    name: t.exposeString('name', {
      nullable: false,
    }),
    floors: t.field({
      type: [Floor],
      plan: ($place) => {
        const $floors = get($place, 'floors') as Step<number[]>;
        return each($floors, ($floor) => lambda($floor, getFloor));
      },
    }),
  }),
});

export const SafeRoomStock = builder
  .unionType('SafeRoomStock', {
    types: [Consumable, MiscItem, Equipment],
  })
  .withPlan(ItemResolver);

export const ClubStock = builder
  .unionType('ClubStock', {
    types: [Consumable, MiscItem, UtilityItem],
  })
  .withPlan(ItemResolver);

export const SafeRoom = builder.objectRef<SafeRoomData & LocationData>('SafeRoom').implement({
  interfaces: [Location],
  fields: (t) => ({
    hasPersonalSpace: t.exposeBoolean('hasPersonalSpace'),
    manager: t.expose('manager', {
      type: NPC,
    }),
    stock: t.expose('stock', {
      type: [SafeRoomStock],
    }),
  }),
});

export const Club = builder.objectRef<ClubData & LocationData>('Club').implement({
  interfaces: [Location],
  fields: (t) => ({
    manager: t.expose('manager', {
      type: NPC,
    }),
    security: t.field({
      type: [Security],
      plan: ($club) => {
        const $ids = inhibitOnNull(get($club, 'security') as Step<number[]>);
        return each($ids, ($id) => {
          return loadOne($id, batchGetNpcById);
        });
      },
    }),
    tagline: t.exposeString('tagline', {
      nullable: false,
    }),
    stock: t.expose('stock', {
      type: [ClubStock],
    }),
  }),
});

export const Stairwell = builder.objectRef<LocationData>('Stairwell').implement({
  interfaces: [Location],
});

export const BetaLocation = builder.objectRef<LocationData>('BetaLocation').implement({
  interfaces: [Location],
});

export const Floor = builder.objectRef<FloorData>('Floor').implement({
  fields: (t) => ({
    number: t.exposeInt('number', {
      nullable: false,
    }),
  }),
});

builder.objectFields(Floor, (t) => ({
  locations: t.field({
    type: [Location],
    nullable: {
      items: true,
      list: true,
    },
    plan: ($floor) => {
      const $number = get($floor, 'number');
      const $db = context().get('dccDb');
      return loadMany($number, {
        load: batchGetLocationsByFloorNumber,
        shared: $db,
      });
    },
  }),
}));
