import SchemaBuilder from '@pothos/core';

// #region backing-model
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
// #endregion backing-model

const Characters: ICharacter[] = [
  { kind: 'Hobbit', id: '1', name: 'Frodo Baggins', shireAddress: 'Bag End' },
  { kind: 'Elf', id: '2', name: 'Galadriel', departed: true },
  { kind: 'Wizard', id: '3', name: 'Gandalf', order: 'Istari', color: 'Grey' },
];

const builder = new SchemaBuilder({});

// #region interface-type
const Character = builder.interfaceRef<ICharacter>('Character');

builder.interfaceType(Character, {
  description: 'A named being of Middle-earth.',
  resolveType: (val) => val.kind,
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});
// #endregion interface-type

// #region members
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
// #endregion members

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
