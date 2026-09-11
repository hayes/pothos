import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildSchema, graphql, printSchema, validateSchema } = require('graphql');
const { schema: overview } = require('./overview.ts');
const { schema } = require('./schema.ts');
require('./printing.ts');

const result = await graphql({ schema, source: await readFile('query.graphql', 'utf8') });
assert.deepEqual(
  JSON.parse(JSON.stringify(result)),
  JSON.parse(await readFile('expected.json', 'utf8')),
);
for (const [source, expected] of [
  ['{ hello }', 'hello, World'],
  ['{ hello(name: null) }', 'hello, World'],
  ['{ hello(name: "") }', 'hello, '],
]) {
  const response = await graphql({ schema, source });
  assert.equal(response.errors, undefined);
  assert.equal(response.data.hello, expected);
}
const giraffe = await graphql({ schema: overview, source: '{ giraffe { name heightInFeet } }' });
assert.deepEqual(JSON.parse(JSON.stringify(giraffe)), {
  data: { giraffe: { name: 'Gina', heightInFeet: 16.4042 } },
});
const backingField = await graphql({ schema: overview, source: '{ giraffe { heightInMeters } }' });
assert.equal(backingField.errors?.length, 1);
assert.match(backingField.errors[0].message, /Cannot query field "heightInMeters"/);

const sdl = await readFile('schema.graphql', 'utf8');
const restored = buildSchema(sdl);
assert.deepEqual(validateSchema(restored), []);
assert.equal(printSchema(restored), printSchema(schema));
console.log(
  'Passed: guide query and arguments, overview backing data, and printed SDL round trip.',
);
