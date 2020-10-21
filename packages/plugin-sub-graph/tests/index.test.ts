import { lexicographicSortSchema, printSchema } from 'graphql';
import builder from './examples/starwars/builder';
import './examples/starwars/schema';

describe('subGraphs', () => {
  test('full graph', async () => {
    const fullSchema = builder.toSchema({});

    expect(printSchema(lexicographicSortSchema(fullSchema))).toMatchSnapshot();
  });

  test('Private graph', async () => {
    const privateSchema = builder.toSubGraphSchema({}, 'Private');

    expect(printSchema(lexicographicSortSchema(privateSchema))).toMatchSnapshot();
  });

  test('Public graph', async () => {
    const publicSchema = builder.toSubGraphSchema({}, 'Public');

    expect(printSchema(lexicographicSortSchema(publicSchema))).toMatchSnapshot();
  });
});
