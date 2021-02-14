import './examples/starwars/schema';
import { lexicographicSortSchema, printSchema } from 'graphql';
import builder from './examples/starwars/builder';

describe('subGraphs', () => {
  test('full graph', () => {
    const fullSchema = builder.toSchema({});

    expect(printSchema(lexicographicSortSchema(fullSchema))).toMatchSnapshot();
  });

  test('Private graph', () => {
    const privateSchema = builder.toSchema({ subGraph: 'Private' });

    expect(printSchema(lexicographicSortSchema(privateSchema))).toMatchSnapshot();
  });

  test('Public graph', () => {
    const publicSchema = builder.toSchema({ subGraph: 'Public' });

    expect(printSchema(lexicographicSortSchema(publicSchema))).toMatchSnapshot();
  });
});
