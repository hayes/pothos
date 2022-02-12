import './examples/starwars/schema';
import { execute } from 'graphql';
import { gql } from 'graphql-tag';
import builder from './examples/starwars/builder';

describe('mocked', () => {
  it('query some stuff', async () => {
    const mockedSchema = builder.toSchema({
      mocks: {
        Character: {
          name: () => 'C-3PO',
        },
      },
    });

    const query = gql`
      query {
        r2d2 {
          name
        }
      }
    `;

    const result = await execute({
      schema: mockedSchema,
      document: query,
      contextValue: {},
    });

    expect(result).toMatchSnapshot();
  });

  describe('type mocks', () => {
    it('queries stuff', async () => {
      const DroidMock = builder.createObjectMock('Droid', () => ({
        name: 'C-3PO',
      }));
      const mockedSchema = builder.toSchema({
        mocks: {},
        typeMocks: [DroidMock],
      });

      const query = gql`
        query {
          r2d2 {
            name
          }
        }
      `;

      const result = await execute({
        schema: mockedSchema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });

    it('queries lists', async () => {
      const DroidMock = builder.createObjectMock('Droid', () => ({
        type: 'Droid' as const,
        name: 'C-3PO',
        friends: ['1002', '1003'],
      }));
      const mockedSchema = builder.toSchema({
        mocks: {},
        typeMocks: [DroidMock],
      });

      const query = gql`
        query {
          r2d2 {
            name
            friends {
              name
            }
          }
        }
      `;

      const result = await execute({
        schema: mockedSchema,
        document: query,
        contextValue: {},
      });

      expect(result).toMatchSnapshot();
    });
  });
});
