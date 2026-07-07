import { builder } from '../builder.ts';
import {
  Characters,
  type IArtifact,
  type IItem,
  type IRingOfPower,
  Items,
  type IWeapon,
} from '../data/canon.ts';
import { Character } from './character.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export const Item = builder.interfaceRef<IItem>('Item');

builder.interfaceType(Item, {
  description: 'A notable object — weapon, ring of power, or other artifact.',
  resolveType: (item) => item.kind,
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    forgedBy: t.exposeString('forgedBy', { nullable: true }),
  }),
});

// ---------------------------------------------------------------------------
// Concrete variants
// ---------------------------------------------------------------------------

export const Weapon = builder.objectRef<IWeapon>('Weapon');
Weapon.implement({
  interfaces: [Item],
  isTypeOf: (val) => (val as IItem).kind === 'Weapon',
  fields: (t) => ({
    weaponType: t.exposeString('weaponType'),
    wielders: t.field({
      type: [Character],
      resolve: (w) =>
        w.wielderIds.map((id) => Characters.get(id)).filter((c) => Boolean(c)) as never,
    }),
  }),
});

export const RingOfPower = builder.objectRef<IRingOfPower>('RingOfPower');
RingOfPower.implement({
  description: 'One of the Rings of Power.',
  interfaces: [Item],
  isTypeOf: (val) => (val as IItem).kind === 'RingOfPower',
  fields: (t) => ({
    inscription: t.exposeString('inscription', { nullable: true }),
    bearers: t.field({
      description: 'Ordered chain of bearers, from earliest to most recent.',
      type: [Character],
      resolve: (r) =>
        r.bearerHistory.map((id) => Characters.get(id)).filter((c) => Boolean(c)) as never,
    }),
  }),
});

export const Artifact = builder.objectRef<IArtifact>('Artifact');
Artifact.implement({
  description: 'A notable object that is neither a weapon nor a ring of power.',
  interfaces: [Item],
  isTypeOf: (val) => (val as IItem).kind === 'Artifact',
  fields: (t) => ({
    powerDescription: t.exposeString('powerDescription'),
  }),
});

// ---------------------------------------------------------------------------
// Query entrypoints
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  items: t.field({
    type: [Item],
    resolve: () => [...Items.values()],
  }),
  item: t.field({
    type: Item,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Items.get(String(id)) ?? null,
  }),
}));
