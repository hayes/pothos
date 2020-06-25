import builder, { Giraffe } from './builder';

const GiraffeRef = builder.objectRef<Giraffe>('GiraffeFromRef');

builder.objectType(Giraffe, {
  name: 'GiraffeFromClass',
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    age: t.int({
      resolve: (parent) => {
        const today = new Date(new Date().toDateString());
        const birthday = new Date(parent.birthday.toDateString());
        const ageDifMs = Number(today) - Number(birthday);
        const ageDate = new Date(ageDifMs);

        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

builder.objectType('Giraffe', {
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    age: t.int({
      resolve: (parent) => {
        const today = new Date(new Date().toDateString());
        const birthday = new Date(parent.birthday.toDateString());
        const ageDifMs = Number(today) - Number(birthday);
        const ageDate = new Date(ageDifMs);

        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

builder.objectType(GiraffeRef, {
  description: 'Long necks, cool patterns, taller than you.',
  fields: (t) => ({
    name: t.exposeString('name', {}),
    age: t.int({
      resolve: (parent) => {
        const today = new Date(new Date().toDateString());
        const birthday = new Date(parent.birthday.toDateString());
        const ageDifMs = Number(today) - Number(birthday);
        const ageDate = new Date(ageDifMs);

        return Math.abs(ageDate.getUTCFullYear() - 1970);
      },
    }),
  }),
});

builder.queryFields((t) => ({
  giraffe: t.field({
    type: 'Giraffe',
    resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
  }),
  giraffeClass: t.field({
    type: Giraffe,
    resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
  }),
  giraffeRef: t.field({
    type: GiraffeRef,
    resolve: () => new Giraffe('James', new Date(2012, 11, 12), 5.2),
  }),
}));
