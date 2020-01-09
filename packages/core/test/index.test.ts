import { printSchema } from 'graphql';
import exampleSchema from './examples/random-stuff';
import giraffeSchema from './examples/giraffes';
import statefulSchema from './examples/stateful';

describe('Example schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(exampleSchema)).toMatchSnapshot();
  });
});

describe('Giraffe schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(giraffeSchema)).toMatchSnapshot();
  });
});

describe('Stateful schema', () => {
  test('generates expected schema', () => {
    expect(printSchema(statefulSchema)).toMatchSnapshot();
  });
});
