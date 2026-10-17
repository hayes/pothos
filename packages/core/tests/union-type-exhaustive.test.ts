import { execute, parse } from 'graphql';
import SchemaBuilder from '../src';

describe('unionTypeExhaustive', () => {
  // Problem
  it("unionType doesn't catch the non-exhaustive error at compile time", async () => {
    const builder = new SchemaBuilder({});

    type AnimalFromDb = {
      type: 'cat' | 'dog';
    };

    const Cat = builder.objectRef<AnimalFromDb>('Cat').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        meows: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const Dog = builder.objectRef<AnimalFromDb>('Dog').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        barks: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const AnimalType = builder.enumType('AnimalType', {
      values: ['cat', 'dog'],
    });

    const Animal = builder.unionType('Animal', {
      types: [Cat], // oops we forgot to add Dog here
      resolveType: (value) => {
        switch (value.type) {
          case 'cat':
            return Cat;
          case 'dog':
            return Dog;
          default:
            value.type satisfies never;
            throw new Error(`Unknown animal type: ${value.type}`);
        }
      },
    });

    builder.queryType({
      fields: (t) => ({
        animal: t.field({ type: Animal, resolve: () => ({ type: 'dog' as const }) }),
      }),
    });

    const schema = builder.toSchema();

    const result = await execute({
      schema,
      document: parse('{ animal { __typename } }'),
    });

    expect(result.data).toEqual({ animal: null });
    expect(result.errors?.[0]?.message).toMatch(
      'Runtime Object type "Dog" is not a possible type for "Animal".',
    );
  });

  // Solution
  it('unionTypeExhaustive catches the non-exhaustive error at compile time', () => {
    const builder = new SchemaBuilder({});

    type AnimalFromDb = {
      type: 'cat' | 'dog';
    };

    const Cat = builder.objectRef<AnimalFromDb>('Cat').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        meows: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const Dog = builder.objectRef<AnimalFromDb>('Dog').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        barks: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const AnimalType = builder.enumType('AnimalType', {
      values: ['cat', 'dog'],
    });

    builder.unionTypeExhaustive('BadAnimal', {
      types: { Cat }, // oops we forgot to add Dog here again but now the error is caught at compile time
      // @ts-expect-error "Dog" is not assignable to "Cat"
      resolveType: (value) => {
        switch (value.type) {
          case 'cat':
            return 'Cat';
          case 'dog':
            return 'Dog';
          default:
            value.type satisfies never;
            throw new Error(`Unknown animal type: ${value.type}`);
        }
      },
    });

    builder.unionTypeExhaustive('GoodAnimal', {
      types: { Cat, Dog },
      resolveType: (value) => {
        switch (value.type) {
          case 'cat':
            return 'Cat';
          case 'dog':
            return 'Dog';
          default:
            value.type satisfies never;
            throw new Error(`Unknown animal type: ${value.type}`);
        }
      },
    });

    // Note that unionTypeExhaustive is meant to gaurantee non-exhaustiveness on `types` option,
    // the `resolveType` function can still be non-exhaustive, users have to write `satisfies never` themselves
    // (becuse that's just how TypeScript works) or use the following simpler syntax

    builder.unionTypeExhaustive('BestAnimal', {
      types: { cat: Cat, dog: Dog },
      resolveType: (value) => value.type,
    });
  });

  // Addendum
  it('unionType with correct types also catches the non-exhaustive error at compile time but requires educating users', () => {
    const builder = new SchemaBuilder({});

    type AnimalFromDb = {
      type: 'cat' | 'dog';
    };

    // notice the `Omit<AnimalFromDb, "type"> & { type: "cat" }` instead of `AnimalFromDb`
    const Cat = builder.objectRef<Omit<AnimalFromDb, 'type'> & { type: 'cat' }>('Cat').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        meows: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const Dog = builder.objectRef<Omit<AnimalFromDb, 'type'> & { type: 'dog' }>('Dog').implement({
      fields: (t) => ({
        type: t.expose('type', { type: AnimalType }),
        barks: t.field({ type: 'Boolean', resolve: () => true }),
      }),
    });

    const AnimalType = builder.enumType('AnimalType', {
      values: ['cat', 'dog'],
    });

    builder.unionType('Animal', {
      types: [Cat], // oops we forgot to add Dog here again but now the error is caught at compile time
      // @ts-expect-error Dog is not assignable to Cat
      resolveType: (value) => {
        switch (value.type) {
          case 'cat':
            return Cat;
          // @ts-expect-error "dog" is not assignable to "cat"
          case 'dog':
            return Dog;
          default:
            value.type satisfies never;
            throw new Error(`Unknown animal type: ${value.type}`);
        }
      },
    });
  });
});
