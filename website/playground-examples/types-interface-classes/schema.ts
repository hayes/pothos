import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region classes
class Animal {
  constructor(public diet: string) {}
}

class Giraffe extends Animal {
  constructor(public heightInMeters: number) {
    super('herbivore');
  }
}

class Lion extends Animal {
  constructor(public hasMane: boolean) {
    super('carnivore');
  }
}

builder.interfaceType(Animal, {
  name: 'Animal',
  fields: (t) => ({ diet: t.exposeString('diet') }),
});

builder.objectType(Giraffe, {
  name: 'Giraffe',
  interfaces: [Animal],
  isTypeOf: (value) => value instanceof Giraffe,
  fields: (t) => ({ height: t.exposeFloat('heightInMeters') }),
});

builder.objectType(Lion, {
  name: 'Lion',
  interfaces: [Animal],
  isTypeOf: (value) => value instanceof Lion,
  fields: (t) => ({ hasMane: t.exposeBoolean('hasMane') }),
});
// #endregion classes

// #region instances
builder.queryType({
  fields: (t) => ({
    animals: t.field({
      type: [Animal],
      resolve: () => [new Giraffe(5.2), new Lion(true)],
    }),
  }),
});
// #endregion instances

export const schema = builder.toSchema();
