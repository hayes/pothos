import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define enum for diet
export enum Diet {
  HERBIVOROUS = 0,
  CARNIVOROUS = 1,
  OMNIVORIOUS = 2,
}

builder.enumType(Diet, {
  name: 'Diet',
});

// Animal class and Giraffe class
export class Animal {
  diet: Diet;

  constructor(diet: Diet) {
    this.diet = diet;
  }
}

export class Giraffe extends Animal {
  name: string;
  birthday: Date;
  heightInMeters: number;

  constructor(name: string, birthday: Date, heightInMeters: number) {
    super(Diet.HERBIVOROUS);
    this.name = name;
    this.birthday = birthday;
    this.heightInMeters = heightInMeters;
  }
}

// Define Animal interface
builder.interfaceType(Animal, {
  name: 'Animal',
  fields: (t) => ({
    diet: t.field({
      type: Diet,
      resolve: (parent) => parent.diet,
    }),
  }),
});

// Implement Giraffe object type
builder.objectType(Giraffe, {
  name: 'Giraffe',
  interfaces: [Animal],
  isTypeOf: (value) => value instanceof Giraffe,
  fields: (t) => ({
    name: t.exposeString('name', {}),
  }),
});

// Define Query type
builder.queryType({});

// Add query fields
builder.queryFields((t) => ({
  animal: t.field({
    type: Animal,
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
}));

builder.queryField('giraffe', (t) =>
  t.field({
    type: Giraffe,
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
);

export const schema = builder.toSchema();
