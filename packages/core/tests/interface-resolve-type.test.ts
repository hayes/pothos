import { execute, GraphQLInterfaceType } from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder from '../src';

interface Animal {
  id: string;
  legs: number;
}

describe('interface resolveType', () => {
  it('receives the GraphQLInterfaceType as its fourth argument', async () => {
    const builder = new SchemaBuilder({});
    const seen: unknown[] = [];

    const animal = builder.interfaceRef<Animal>('Animal');

    animal.implement({
      resolveType: (_parent, _context, _info, type) => {
        // `getInterfaces` only exists on GraphQLInterfaceType, so this also pins the static type.
        seen.push(type.getInterfaces());

        return 'Dog';
      },
      fields: (t) => ({
        id: t.id({
          resolve: (parent) => parent.id,
          exampleRequiredOptionFromPlugin: true,
        }),
      }),
    });

    builder.objectRef<Animal>('Dog').implement({
      interfaces: [animal],
      fields: (t) => ({ legs: t.int({ resolve: (parent) => parent.legs }) }),
    });

    builder.queryType({
      fields: (t) => ({
        animal: t.field({ type: animal, resolve: () => ({ id: '1', legs: 4 }) }),
      }),
    });

    const schema = builder.toSchema();

    expect(schema.getType('Animal')).toBeInstanceOf(GraphQLInterfaceType);

    const result = await execute({
      schema,
      document: gql`
        query {
          animal {
            id
            ... on Dog {
              legs
            }
          }
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ animal: { id: '1', legs: 4 } });
    expect(seen).toEqual([[]]);
  });

  it.each([
    ['a name', (_ref: unknown) => () => 'Dog'],
    ['a ref', (ref: unknown) => () => ref],
    ['a promise of a ref', (ref: unknown) => () => Promise.resolve(ref)],
  ] as const)('resolves a type returned as %s', async (_label, makeResolver) => {
    const builder = new SchemaBuilder({});
    const animal = builder.interfaceRef<Animal>('Animal');
    const dog = builder.objectRef<Animal>('Dog');

    animal.implement({
      resolveType: makeResolver(dog) as never,
      fields: (t) => ({
        id: t.id({
          resolve: (parent) => parent.id,
          exampleRequiredOptionFromPlugin: true,
        }),
      }),
    });

    dog.implement({
      interfaces: [animal],
      fields: (t) => ({ legs: t.int({ resolve: (parent) => parent.legs }) }),
    });

    builder.queryType({
      fields: (t) => ({
        animal: t.field({ type: animal, resolve: () => ({ id: '1', legs: 4 }) }),
      }),
    });

    const result = await execute({
      schema: builder.toSchema(),
      document: gql`
        query {
          animal {
            id
            ... on Dog {
              legs
            }
          }
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ animal: { id: '1', legs: 4 } });
  });
});
