import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { vi } from 'vitest';
import { complexityFromQuery, createComplexityRule } from '../src';

it.each([
  'query { ...A } fragment A on Query { ...A }',
  'query { ...A } fragment A on Query { ...B } fragment B on Query { ...A }',
])('reports fragment cycles during normal validation: %s', (source) => {
  const schema = buildSchema('type Query { value: Int }');
  const errors = validate(schema, parse(source), [
    ...specifiedRules,
    createComplexityRule({ context: {}, variableValues: {}, maxComplexity: 10 }),
  ]);
  expect(errors.length).toBeGreaterThan(0);
  expect(errors.some((error) => /fragment|cycle/i.test(error.message))).toBe(true);
});

it('counts repeated fragment occurrences without repeatedly evaluating their fields', () => {
  const schema = buildSchema('type Query { value: Int }');
  const cost = vi.fn(() => 2);
  schema.getQueryType()!.getFields().value.extensions = { complexity: cost };
  const depth = 24;
  const fragments = ['fragment F0 on Query { value }'];
  for (let i = 1; i <= depth; i += 1) {
    fragments.push(`fragment F${i} on Query { ...F${i - 1} ...F${i - 1} }`);
  }
  const source = `query { ...F${depth} } ${fragments.join('\n')}`;
  const result = complexityFromQuery(source, { schema });
  expect(result).toEqual({ complexity: 2 ** (depth + 1), breadth: 2 ** depth, depth: 1 });
  expect(cost).toHaveBeenCalledTimes(1);
});
