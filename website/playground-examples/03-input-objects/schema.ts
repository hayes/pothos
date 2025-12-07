import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// The Giraffe class from the objects guide
class Giraffe {
  name: string;
  birthday: Date;
  heightInMeters: number;

  constructor(name: string, birthday: Date, height: number) {
    this.name = name;
    this.birthday = birthday;
    this.heightInMeters = height;
  }
}

const GiraffeRef = builder.objectRef<Giraffe>('Giraffe');

GiraffeRef.implement({
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name'),
    height: t.exposeFloat('heightInMeters'),
    age: t.int({
      resolve: (parent) => {
        const ageDifMs = Date.now() - parent.birthday.getTime();
        const ageDate = new Date(ageDifMs);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

// Create an input type for Giraffe
const GiraffeInput = builder.inputType('GiraffeInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    birthdate: t.string({ required: true }),
    height: t.float({ required: true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: GiraffeRef,
      resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    createGiraffe: t.field({
      type: GiraffeRef,
      args: {
        input: t.arg({ type: GiraffeInput, required: true }),
      },
      resolve: (_root, args) =>
        new Giraffe(args.input.name, new Date(args.input.birthdate), args.input.height),
    }),
  }),
});

export const schema = builder.toSchema();
