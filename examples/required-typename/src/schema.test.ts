import { describe, expect, it } from 'vitest';
import { execute, parse } from 'graphql';
import { schema } from './schema';

describe('requiredTypename plugin', () => {
  it('should resolve pets with __typename', async () => {
    const query = parse(`
      query {
        pets {
          __typename
          ... on Dog {
            name
            breed
          }
          ... on Cat {
            name
            livesRemaining
          }
        }
      }
    `);

    const result = await execute({ schema, document: query });
    
    expect(result.errors).toBeUndefined();
    expect(result.data?.pets).toBeDefined();
    expect(Array.isArray(result.data?.pets)).toBe(true);
    
    const pets = result.data?.pets as Array<{ __typename: string; name: string }>;
    expect(pets.length).toBeGreaterThan(0);
    
    for (const pet of pets) {
      expect(pet.__typename).toBeDefined();
      expect(['Dog', 'Cat']).toContain(pet.__typename);
      expect(pet.name).toBeDefined();
    }
  });

  it('should resolve nodes with __typename', async () => {
    const query = parse(`
      query {
        nodes {
          __typename
          id
          ... on Person {
            name
          }
          ... on Company {
            companyName
          }
        }
      }
    `);

    const result = await execute({ schema, document: query });
    
    expect(result.errors).toBeUndefined();
    expect(result.data?.nodes).toBeDefined();
    expect(Array.isArray(result.data?.nodes)).toBe(true);
    
    const nodes = result.data?.nodes as Array<{ __typename: string; id: string }>;
    expect(nodes.length).toBeGreaterThan(0);
    
    for (const node of nodes) {
      expect(node.__typename).toBeDefined();
      expect(['Person', 'Company']).toContain(node.__typename);
      expect(node.id).toBeDefined();
    }
  });

  it('should resolve single pet with __typename', async () => {
    const query = parse(`
      query {
        pet(name: "Fido") {
          __typename
          ... on Dog {
            name
            breed
          }
        }
      }
    `);

    const result = await execute({ schema, document: query });
    
    expect(result.errors).toBeUndefined();
    expect(result.data?.pet).toBeDefined();
    
    const pet = result.data?.pet as { __typename: string; name: string; breed: string };
    expect(pet.__typename).toBe('Dog');
    expect(pet.name).toBe('Fido');
    expect(pet.breed).toBe('Golden Retriever');
  });
});
