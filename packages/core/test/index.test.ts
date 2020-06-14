import { printSchema, lexicographicSortSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';
import giraffeSchema from './examples/giraffes';
import statefulSchema from './examples/stateful';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(exampleSchema))).toMatchSnapshot();
  });
});

describe('Giraffe schema', () => {
  test.only('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(giraffeSchema))).toMatchSnapshot();
  });
});

describe('Stateful schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(lexicographicSortSchema(statefulSchema))).toMatchSnapshot();
  });
});
