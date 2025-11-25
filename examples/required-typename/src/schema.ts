import { builder } from './builder';

// Define data types
interface Dog {
  __typename: 'Dog';
  name: string;
  breed: string;
}

interface Cat {
  __typename: 'Cat';
  name: string;
  livesRemaining: number;
}

interface Person {
  id: string;
  name: string;
}

interface Company {
  id: string;
  companyName: string;
}

// Sample data
const dogs: Dog[] = [
  { __typename: 'Dog', name: 'Fido', breed: 'Golden Retriever' },
  { __typename: 'Dog', name: 'Rex', breed: 'German Shepherd' },
];

const cats: Cat[] = [
  { __typename: 'Cat', name: 'Whiskers', livesRemaining: 7 },
  { __typename: 'Cat', name: 'Mittens', livesRemaining: 9 },
];

const people: Person[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const companies: Company[] = [
  { id: '1', companyName: 'Acme Corp' },
  { id: '2', companyName: 'TechStart Inc' },
];

// Define object types
const DogType = builder.objectRef<Dog>('Dog').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    breed: t.exposeString('breed'),
  }),
});

const CatType = builder.objectRef<Cat>('Cat').implement({
  fields: (t) => ({
    name: t.exposeString('name'),
    livesRemaining: t.exposeInt('livesRemaining'),
  }),
});

const PersonType = builder.objectRef<Person>('Person').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

const CompanyType = builder.objectRef<Company>('Company').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    companyName: t.exposeString('companyName'),
  }),
});

// Create a union with requiredTypename - chained immediately
const PetUnion = builder
  .unionType('Pet', {
    types: [DogType, CatType],
    resolveType: (pet) => pet.__typename,
  })
  .requiredTypename();

// Create an interface with requiredTypename - chained immediately
const NodeInterface = builder
  .interfaceRef<{ id: string }>('Node')
  .implement({
    fields: (t) => ({
      id: t.exposeID('id'),
    }),
  })
  .requiredTypename();

// Implement the interface on types (by re-implementing with interface)
builder.objectType(PersonType, {
  interfaces: [NodeInterface],
  fields: (_t) => ({}),
});

builder.objectType(CompanyType, {
  interfaces: [NodeInterface],
  fields: (_t) => ({}),
});

// Define Query type
builder.queryType({
  fields: (t) => ({
    // Field returning union - TypeScript will require __typename in resolver
    pets: t.field({
      type: [PetUnion],
      resolve: () => {
        // The return type here requires __typename to be present
        // TypeScript will enforce this at compile time
        return [...dogs, ...cats];
      },
    }),
    // Field returning interface - TypeScript will require __typename in resolver
    nodes: t.field({
      type: [NodeInterface],
      resolve: () => {
        // TypeScript requires __typename here, but we need to add it since
        // our data doesn't have it naturally
        return [
          ...people.map((p) => ({ ...p, __typename: 'Person' as const })),
          ...companies.map((c) => ({ ...c, __typename: 'Company' as const })),
        ];
      },
    }),
    pet: t.field({
      type: PetUnion,
      nullable: true,
      args: {
        name: t.arg.string({ required: true }),
      },
      resolve: (_, args) => {
        const allPets = [...dogs, ...cats];
        return allPets.find((pet) => pet.name === args.name) ?? null;
      },
    }),
  }),
});

export const schema = builder.toSchema();
