import { builder } from '../builder.ts';
import {
  type ILocation,
  type IRealm,
  type ISettlement,
  type IStronghold,
  type IWilderness,
  Locations,
} from '../data/canon.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export const Location = builder.interfaceRef<ILocation>('Location');

builder.interfaceType(Location, {
  description: 'A place in Middle-earth — a realm, settlement, wild region, or stronghold.',
  resolveType: (loc) => loc.kind,
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

// ---------------------------------------------------------------------------
// Concrete variants
// ---------------------------------------------------------------------------

export const Realm = builder.objectRef<IRealm>('Realm');
Realm.implement({
  description: 'A political or cultural region (e.g. Gondor, Rohan).',
  interfaces: [Location],
  isTypeOf: (val) => (val as ILocation).kind === 'Realm',
  fields: (t) => ({
    ruler: t.exposeString('ruler', { nullable: true }),
    settlements: t.field({
      type: [Settlement],
      resolve: (realm) =>
        [...Locations.values()].filter(
          (l): l is ISettlement => l.kind === 'Settlement' && l.realmId === realm.id,
        ),
    }),
  }),
});

export const Settlement = builder.objectRef<ISettlement>('Settlement');
Settlement.implement({
  description: 'A city, town, or village.',
  interfaces: [Location],
  isTypeOf: (val) => (val as ILocation).kind === 'Settlement',
  fields: (t) => ({
    realm: t.field({
      type: Realm,
      nullable: true,
      resolve: (s) => {
        if (!s.realmId) {
          return null;
        }
        const loc = Locations.get(s.realmId);
        return loc && loc.kind === 'Realm' ? loc : null;
      },
    }),
  }),
});

export const Wilderness = builder.objectRef<IWilderness>('Wilderness');
Wilderness.implement({
  description: 'A wild region — forest, mountain range, river.',
  interfaces: [Location],
  isTypeOf: (val) => (val as ILocation).kind === 'Wilderness',
  fields: (t) => ({
    terrain: t.exposeString('terrain'),
  }),
});

export const Stronghold = builder.objectRef<IStronghold>('Stronghold');
Stronghold.implement({
  description: 'A fortress or fortified place.',
  interfaces: [Location],
  isTypeOf: (val) => (val as ILocation).kind === 'Stronghold',
  fields: (t) => ({
    controlledBy: t.exposeString('controlledBy', { nullable: true }),
  }),
});

// ---------------------------------------------------------------------------
// Query entrypoints
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  locations: t.field({
    type: [Location],
    resolve: () => [...Locations.values()],
  }),
  location: t.field({
    type: Location,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Locations.get(String(id)) ?? null,
  }),
}));
