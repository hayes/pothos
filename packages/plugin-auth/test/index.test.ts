import { printSchema } from 'graphql';
import exampleSchema from './examples/auth/schema';

describe('auth example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(exampleSchema)).toMatchSnapshot();
  });

  // describe('queries', () => {});
});
