import { printSchema } from 'graphql';
import exampleSchema from './examples/extends/schema';

describe('extends example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(exampleSchema)).toMatchSnapshot();
  });

  // describe('queries', () => {});
});
