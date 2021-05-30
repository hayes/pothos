import './examples/starwars/schema';
import { lexicographicSortSchema, printSchema } from 'graphql';
import builder from './examples/starwars/builder';

describe('subGraphs', () => {
  it('full graph', () => {
    const fullSchema = builder.toSchema({});

    expect(printSchema(lexicographicSortSchema(fullSchema))).toMatchSnapshot();
  });

  it('Private graph', () => {
    const privateSchema = builder.toSchema({ subGraph: 'Private' });

    expect(printSchema(lexicographicSortSchema(privateSchema))).toMatchSnapshot();
  });

  it('Public graph', () => {
    const publicSchema = builder.toSchema({ subGraph: 'Public' });

    expect(printSchema(lexicographicSortSchema(publicSchema))).toMatchSnapshot();
  });

  it('multiple', () => {
    const publicSchema = builder.toSchema({ subGraph: ['Public', 'Private'] });

    expect(printSchema(lexicographicSortSchema(publicSchema))).toMatchSnapshot();
  });
});
