import { builder } from '../builder.ts';
import {
  Battles,
  Characters,
  Factions,
  type ICharacter,
  type IDwarf,
  type IElf,
  type IHobbit,
  type IMan,
  type IOrc,
  Items,
  type IWeapon,
  type IWizard,
  Quotes,
  Races,
} from '../data/canon.ts';
import { Battle } from './battle.ts';
import { Quote } from './book.ts';
import { Faction } from './faction.ts';
import { Weapon } from './item.ts';
import { Race } from './race.ts';

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export const Character = builder.interfaceRef<ICharacter>('Character');

builder.interfaceType(Character, {
  description: 'A named being of Middle-earth.',
  resolveType: (c) => c.kind,
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    race: t.field({
      type: Race,
      resolve: (c) => Races.get(c.raceId)!,
    }),
    factions: t.field({
      type: [Faction],
      resolve: (c) => c.factionIds.map((id) => Factions.get(id)).filter((f) => Boolean(f)) as never,
    }),
    battles: t.field({
      description: 'Battles this character is recorded as participating in.',
      type: [Battle],
      resolve: (c) => [...Battles.values()].filter((b) => b.participantIds.includes(c.id)),
    }),
    quotes: t.field({
      description: 'Quotes attributed to this character.',
      type: [Quote],
      resolve: (c) => [...Quotes.values()].filter((q) => q.characterId === c.id),
    }),
    wieldedWeapons: t.field({
      description: 'Notable weapons this character has wielded.',
      type: [Weapon],
      resolve: (c) =>
        [...Items.values()].filter(
          (i): i is IWeapon => i.kind === 'Weapon' && i.wielderIds.includes(c.id),
        ),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Concrete variants
// ---------------------------------------------------------------------------

export const Hobbit = builder.objectRef<IHobbit>('Hobbit');
Hobbit.implement({
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Hobbit',
  fields: (t) => ({
    shireAddress: t.exposeString('shireAddress', { nullable: true }),
  }),
});

export const Elf = builder.objectRef<IElf>('Elf');
Elf.implement({
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Elf',
  fields: (t) => ({
    house: t.exposeString('house', { nullable: true }),
    departed: t.exposeBoolean('departed', {
      description: 'Has this elf taken ship to the Undying Lands?',
    }),
  }),
});

export const Man = builder.objectRef<IMan>('Man');
Man.implement({
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Man',
  fields: (t) => ({
    kingdom: t.exposeString('kingdom', { nullable: true }),
    descent: t.exposeString('descent', { nullable: true }),
  }),
});

export const Dwarf = builder.objectRef<IDwarf>('Dwarf');
Dwarf.implement({
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Dwarf',
  fields: (t) => ({
    clan: t.exposeString('clan', { nullable: true }),
  }),
});

export const Wizard = builder.objectRef<IWizard>('Wizard');
Wizard.implement({
  description: 'One of the Istari — Maiar sent to Middle-earth in mortal form.',
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Wizard',
  fields: (t) => ({
    order: t.exposeString('order'),
    color: t.exposeString('color'),
  }),
});

export const Orc = builder.objectRef<IOrc>('Orc');
Orc.implement({
  interfaces: [Character],
  isTypeOf: (val) => (val as ICharacter).kind === 'Orc',
  fields: (t) => ({
    subtype: t.exposeString('subtype'),
    overlordName: t.exposeString('overlordName', { nullable: true }),
  }),
});

// ---------------------------------------------------------------------------
// Query entrypoints
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  characters: t.field({
    type: [Character],
    args: {
      raceId: t.arg.id(),
    },
    resolve: (_root, { raceId }) => {
      const all = [...Characters.values()];
      return raceId ? all.filter((c) => c.raceId === String(raceId)) : all;
    },
  }),
  character: t.field({
    type: Character,
    nullable: true,
    args: {
      id: t.arg.id(),
      name: t.arg.string(),
    },
    resolve: (_root, { id, name }) => {
      if (id) {
        return Characters.get(String(id)) ?? null;
      }
      if (name) {
        const needle = name.toLowerCase();
        for (const c of Characters.values()) {
          if (c.name.toLowerCase() === needle) {
            return c;
          }
        }
        for (const c of Characters.values()) {
          if (c.name.toLowerCase().startsWith(needle)) {
            return c;
          }
        }
      }
      return null;
    },
  }),
}));
