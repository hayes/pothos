import { execute } from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder, { type SchemaTypes } from '../src';

// Cat and Dog share a backing type, so their refs are the same TypeScript type.
interface Animal {
  type: 'cat' | 'dog';
  name: string;
}

const petsQuery = gql`
  {
    pets {
      __typename
      ... on Cat {
        name
      }
      ... on Dog {
        name
      }
    }
  }
`;

const pets: Animal[] = [
  { type: 'cat', name: 'Tom' },
  { type: 'dog', name: 'Rex' },
];

const petsResult = {
  data: {
    pets: [
      { __typename: 'Cat', name: 'Tom' },
      { __typename: 'Dog', name: 'Rex' },
    ],
  },
};

describe('union types as a record', () => {
  it('resolves the key returned by resolveType', async () => {
    const builder = new SchemaBuilder({});

    const Cat = builder.objectRef<Animal>('Cat').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    const Dog = builder.objectRef<Animal>('Dog').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });

    const Pet = builder.unionType('Pet', {
      types: { cat: Cat, dog: Dog },
      resolveType: (pet) => pet.type,
    });

    builder.unionType('MissingMember', {
      // @ts-expect-error dog is not a key of types (reported against the array overload)
      types: { cat: Cat },
      resolveType: (pet) => pet.type,
    });

    builder.queryType({
      fields: (t) => ({ pets: t.field({ type: [Pet], resolve: () => pets }) }),
    });

    expect(await execute({ schema: builder.toSchema(), document: petsQuery })).toEqual(petsResult);
  });

  it('accepts a thunk and an async resolveType', async () => {
    const builder = new SchemaBuilder({});

    const Pet = builder.unionType('Pet', {
      types: () => ({ cat: Cat, dog: Dog }),
      resolveType: async (pet) => pet.type,
    });

    const Cat = builder.objectRef<Animal>('Cat').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    const Dog = builder.objectRef<Animal>('Dog').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });

    builder.queryType({
      fields: (t) => ({ pets: t.field({ type: [Pet], resolve: () => pets }) }),
    });

    expect(await execute({ schema: builder.toSchema(), document: petsQuery })).toEqual(petsResult);
  });
});

describe('StrictResolveType', () => {
  it('accepts union members as a record or by name', () => {
    const builder = new SchemaBuilder<{
      StrictResolveType: true;
      Objects: { Cat: Animal; Dog: Animal; Bird: Animal };
    }>({});

    const Cat = builder.objectRef<Animal>('Cat');
    const Dog = builder.objectRef<Animal>('Dog');

    builder.unionType('PetRecord', {
      types: { cat: Cat, dog: Dog },
      resolveType: (pet) => pet.type,
    });

    builder.unionType('PetNames', {
      types: ['Cat', 'Dog'],
      resolveType: (pet) => (pet.type === 'cat' ? 'Cat' : 'Dog'),
    });

    builder.unionType('MissingMember', {
      types: ['Cat', 'Dog'],
      // @ts-expect-error Bird is an object type, but not a member
      resolveType: () => 'Bird',
    });

    builder.unionType('PetRefs', {
      // @ts-expect-error refs can't be told apart by type, so a list must use names
      types: [Cat, Dog],
    });
  });

  it('limits interface resolveType to object type names', () => {
    const builder = new SchemaBuilder<{
      StrictResolveType: true;
      Objects: { Cat: Animal };
    }>({});

    const Dog = builder.objectRef<Animal>('Dog');

    builder.interfaceRef<Animal>('Pet').implement({
      resolveType: () => 'Cat',
    });

    builder.interfaceRef<Animal>('Named').implement({
      // @ts-expect-error Dog is not declared in SchemaTypes
      resolveType: () => 'Dog',
    });

    builder.interfaceRef<Animal>('Owned').implement({
      // @ts-expect-error refs can't be told apart by type
      resolveType: () => Dog,
    });
  });

  it('keeps the wider types in code that is generic over SchemaTypes', () => {
    // Plugins build unions against a generic Types, which must accept refs and names either way
    function addUnion<Types extends SchemaTypes>(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
      const Cat = builder.objectRef<Animal>('Cat');

      builder.unionType('Pet', { types: [Cat], resolveType: () => Cat });
      builder.unionType('Named', { types: [Cat], resolveType: () => 'Cat' });
      builder.interfaceRef<Animal>('Owned').implement({ resolveType: () => Cat });
    }

    addUnion(new SchemaBuilder<{ StrictResolveType: true }>({}));
  });

  it('is off by default', () => {
    const builder = new SchemaBuilder({});

    const Cat = builder.objectRef<Animal>('Cat');
    const Dog = builder.objectRef<Animal>('Dog');

    builder.unionType('Pet', {
      types: [Cat, Dog],
      resolveType: (pet) => (pet.type === 'cat' ? Cat : 'Dog'),
    });

    builder.interfaceRef<Animal>('Named').implement({
      resolveType: () => Dog,
    });
  });
});
