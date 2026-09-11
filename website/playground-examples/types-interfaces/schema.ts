// #region model
import SchemaBuilder from '@pothos/core';

type Giraffe = {
  kind: 'giraffe';
  diet: string;
  heightInMeters: number;
};

type Lion = {
  kind: 'lion';
  diet: string;
  hasMane: boolean;
};

type Animal = Giraffe | Lion;

const builder = new SchemaBuilder({});
const AnimalRef = builder.interfaceRef<Animal>('Animal');
const GiraffeRef = builder.objectRef<Giraffe>('Giraffe');
const LionRef = builder.objectRef<Lion>('Lion');

AnimalRef.implement({
  fields: (t) => ({
    diet: t.exposeString('diet'),
  }),
  resolveType: (animal) => {
    switch (animal.kind) {
      case 'giraffe':
        return 'Giraffe';
      case 'lion':
        return 'Lion';
    }
  },
});
// #endregion model

// #region objects
GiraffeRef.implement({
  interfaces: [AnimalRef],
  fields: (t) => ({
    height: t.exposeFloat('heightInMeters'),
  }),
});

LionRef.implement({
  interfaces: [AnimalRef],
  fields: (t) => ({
    hasMane: t.exposeBoolean('hasMane'),
  }),
});
// #endregion objects

// #region query
builder.queryType({
  fields: (t) => ({
    animals: t.field({
      type: [AnimalRef],
      resolve: (): Animal[] => [
        { kind: 'giraffe', diet: 'herbivore', heightInMeters: 5.2 },
        { kind: 'lion', diet: 'carnivore', hasMane: true },
      ],
    }),
  }),
});

export const schema = builder.toSchema();
// #endregion query
