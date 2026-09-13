import { buildSchema, parse, specifiedRules, validate } from 'graphql';
import { complexityFromQuery, createComplexityRule } from '../src';

const schema = buildSchema('type Query { count(n: Int): Int }');
schema.getQueryType()!.getFields().count.extensions = {
  complexity: (args: { n?: number | null }) => args.n ?? 1,
};
const query = 'query($n: Int = 1000) { count(n: $n) }';

it('includes operation defaults in standalone complexity calculations', () => {
  expect(complexityFromQuery(query, { schema }).complexity).toBe(1000);
  expect(complexityFromQuery(query, { schema, variables: { n: 4 } }).complexity).toBe(4);
  expect(complexityFromQuery(query, { schema, variables: { n: null } }).complexity).toBe(1);
});

it('enforces limits against defaults when used as a validation rule', () => {
  const errors = validate(schema, parse(query), [
    ...specifiedRules,
    createComplexityRule({ context: {}, variableValues: {}, maxComplexity: 10 }),
  ]);
  expect(errors.map((error) => error.message)).toEqual([
    'Query complexity of 1000 exceeds max complexity of 10',
  ]);
});

it('reports invalid supplied variables instead of calculating a misleading cost', () => {
  expect(() => complexityFromQuery(query, { schema, variables: { n: 'bad' } })).toThrow();
  const errors = validate(schema, parse(query), [
    ...specifiedRules,
    createComplexityRule({ context: {}, variableValues: { n: 'bad' }, maxComplexity: 10 }),
  ]);
  expect(errors).toHaveLength(1);
  expect(errors[0].message).toMatch(/Int|variable/i);
});

it('coerces nested input defaults and isolates operation defaults', () => {
  const inputSchema = buildSchema(
    'input Limit { size: Int = 7 } type Query { count(limit: Limit): Int }',
  );
  inputSchema.getQueryType()!.getFields().count.extensions = {
    complexity: (args: { limit?: { size: number } }) => args.limit?.size ?? 1,
  };
  expect(
    complexityFromQuery('query($limit: Limit = {}) { count(limit: $limit) }', {
      schema: inputSchema,
    }).complexity,
  ).toBe(7);
  const results: number[] = [];
  validate(
    schema,
    parse('query A($n: Int = 3) { count(n: $n) } query B($n: Int = 4) { count(n: $n) }'),
    [
      createComplexityRule({
        context: {},
        variableValues: {},
        onResult: (result) => {
          results.push(result.complexity);
        },
      }),
    ],
  );
  expect(results).toEqual([3, 4]);
});

it('rejects missing required variables', () => {
  expect(() => complexityFromQuery('query($n: Int!) { count(n: $n) }', { schema })).toThrow(/Int!/);
});
