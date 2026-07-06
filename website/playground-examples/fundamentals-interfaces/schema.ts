import SchemaBuilder from '@pothos/core';

interface ICharacterBase {
  id: string;
  name: string;
}

interface IHobbit extends ICharacterBase {
  kind: 'Hobbit';
  shireAddress?: string;
}

interface IElf extends ICharacterBase {
  kind: 'Elf';
  departed: boolean;
}

interface IWizard extends ICharacterBase {
  kind: 'Wizard';
  order: string;
  color: string;
}

type ICharacter = IHobbit | IElf | IWizard;

const Characters: ICharacter[] = [
  { kind: 'Hobbit', id: 'frodo', name: 'Frodo Baggins', shireAddress: 'Bag End' },
  { kind: 'Elf', id: 'galadriel', name: 'Galadriel', departed: true },
  { kind: 'Wizard', id: 'gandalf', name: 'Gandalf', order: 'Istari', color: 'Grey' },
];

const builder = new SchemaBuilder({});

// #region character-interface
const Character = builder.interfaceRef<ICharacter>('Character');

builder.interfaceType(Character, {
  description: 'A named being of Middle-earth.',
  // resolveType returns the concrete typename. With a `kind`
  // discriminator on the backing object it can be a one-liner.
  resolveType: (val) => val.kind,
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const Hobbit = builder.objectRef<IHobbit>('Hobbit');
Hobbit.implement({
  interfaces: [Character],
  fields: (t) => ({
    shireAddress: t.exposeString('shireAddress', { nullable: true }),
  }),
});

const Elf = builder.objectRef<IElf>('Elf');
Elf.implement({
  interfaces: [Character],
  fields: (t) => ({
    departed: t.exposeBoolean('departed'),
  }),
});
// #endregion character-interface

const Wizard = builder.objectRef<IWizard>('Wizard');
Wizard.implement({
  interfaces: [Character],
  fields: (t) => ({
    order: t.exposeString('order'),
    color: t.exposeString('color'),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => Characters,
    }),
  }),
});

export const schema = builder.toSchema();
