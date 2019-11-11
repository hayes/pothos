import { printSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(exampleSchema)).toMatchSnapshot();
  });
});
