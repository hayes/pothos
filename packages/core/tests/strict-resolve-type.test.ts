import { execute } from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder from '../src';

interface Cat {
  kind: 'cat';
  name: string;
}

interface Dog {
  kind: 'dog';
  name: string;
}

interface Bird {
  kind: 'bird';
  name: string;
}

describe('StrictResolveType', () => {
  it('limits union resolveType to the members', async () => {
    const builder = new SchemaBuilder<{ StrictResolveType: true }>({});

    const CatRef = builder.objectRef<Cat>('Cat').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    const DogRef = builder.objectRef<Dog>('Dog').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });
    const BirdRef = builder.objectRef<Bird>('Bird').implement({
      fields: (t) => ({ name: t.exposeString('name') }),
    });

    const Pet = builder.unionType('Pet', {
      types: [CatRef, DogRef],
      resolveType: (pet) => (pet.kind === 'cat' ? CatRef : DogRef),
    });

    builder.unionType('PetName', {
      types: [CatRef, DogRef],
      // @ts-expect-error a type name is not accepted when the members are refs
      resolveType: (pet) => (pet.kind === 'cat' ? 'Cat' : 'Dog'),
    });

    builder.unionType('MissingMember', {
      types: [CatRef],
      // @ts-expect-error Bird is not a member
      resolveType: () => BirdRef,
    });

    builder.queryType({
      fields: (t) => ({
        pets: t.field({
          type: [Pet],
          resolve: () => [
            { kind: 'cat' as const, name: 'Tom' },
            { kind: 'dog' as const, name: 'Rex' },
          ],
        }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
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
      `,
    });

    expect(result).toEqual({
      data: {
        pets: [
          { __typename: 'Cat', name: 'Tom' },
          { __typename: 'Dog', name: 'Rex' },
        ],
      },
    });
  });

  it('accepts the names of members listed by name', () => {
    const builder = new SchemaBuilder<{
      StrictResolveType: true;
      Objects: { Cat: Cat; Dog: Dog; Bird: Bird };
    }>({});

    builder.unionType('Pet', {
      types: ['Cat', 'Dog'],
      resolveType: (pet) => (pet.kind === 'cat' ? 'Cat' : 'Dog'),
    });

    builder.unionType('MissingMember', {
      types: ['Cat', 'Dog'],
      // @ts-expect-error Bird is an object type, but not a member
      resolveType: () => 'Bird',
    });
  });

  it('limits interface resolveType to object types', () => {
    const builder = new SchemaBuilder<{
      StrictResolveType: true;
      Objects: { Cat: Cat };
    }>({});

    const DogRef = builder.objectRef<Dog>('Dog');

    builder.interfaceRef<Cat | Dog>('Pet').implement({
      resolveType: (pet) => (pet.kind === 'cat' ? 'Cat' : DogRef),
    });

    builder.interfaceRef<Cat | Dog>('Named').implement({
      // @ts-expect-error a type name must be an object type declared in SchemaTypes
      resolveType: () => 'Dog',
    });
  });

  it('accepts any string by default', () => {
    const builder = new SchemaBuilder({});

    const CatRef = builder.objectRef<Cat>('Cat');
    const DogRef = builder.objectRef<Dog>('Dog');

    builder.unionType('Pet', {
      types: [CatRef, DogRef],
      resolveType: (pet) => (pet.kind === 'cat' ? 'Cat' : 'Dog'),
    });

    builder.interfaceRef<Cat | Dog>('Named').implement({
      resolveType: () => 'Dog',
    });
  });
});
