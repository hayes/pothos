import { lexicographicSortSchema, printSchema } from 'graphql';
import builder from './examples/starwars/builder';
import './examples/starwars/schema';

describe('subGraphs', () => {
  test('full graph', () => {
    const fullSchema = builder.toSchema({});

    expect(printSchema(lexicographicSortSchema(fullSchema))).toMatchSnapshot();
  });

  test('Private graph', () => {
    const privateSchema = builder.toSubGraphSchema({}, 'Private');

    expect(printSchema(lexicographicSortSchema(privateSchema))).toMatchSnapshot();
  });

  test('Public graph', () => {
    const publicSchema = builder.toSubGraphSchema({}, 'Public');

    expect(printSchema(lexicographicSortSchema(publicSchema))).toMatchSnapshot();
  });
});
