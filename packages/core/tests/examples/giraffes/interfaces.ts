import builder, { Animal, Diet, Giraffe } from './builder';

export const AnimalRef = builder.interfaceRef<Animal>('AnimalFromRef');

builder.interfaceType(Animal, {
  name: 'AnimalFromClass',
  fields: (t) => ({
    diet: t.expose('diet', {
      exampleRequiredOptionFromPlugin: true,
      type: Diet,
    }),
  }),
});

builder.interfaceType('Animal', {
  fields: (t) => ({
    diet: t.expose('diet', {
      exampleRequiredOptionFromPlugin: true,
      type: Diet,
    }),
  }),
});

builder.interfaceType(AnimalRef, {
  name: 'AnimalFromRef',
  fields: (t) => ({
    diet: t.expose('diet', {
      exampleRequiredOptionFromPlugin: true,
      type: Diet,
    }),
  }),
});

builder.queryFields((t) => ({
  animal: t.field({
    type: 'Animal',
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
  animalClass: t.field({
    type: Animal,
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
  animalRef: t.field({
    type: AnimalRef,
    resolve: () => new Giraffe('James', new Date(Date.UTC(2012, 11, 12)), 5.2),
  }),
}));
