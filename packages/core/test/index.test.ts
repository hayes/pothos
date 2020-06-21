import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';
import giraffeSchema from './examples/giraffes';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});

describe('Giraffe schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(giraffeSchema))).toMatchSnapshot();
  });
});
