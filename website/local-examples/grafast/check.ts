import assert from 'node:assert/strict';
import { grafast } from 'grafast';
import { schema } from './schema';

async function main() {
  const result = await grafast({
    schema,
    source: `query Example($a: Int!, $b: Int!) {
      addTwoNumbers(a: $a, b: $b)
      dog: animal(id: "1") { __typename id }
      cat: animal(id: "2") { __typename id }
      alien: entity(id: "3") { __typename ... on Alien { id } }
      missing: entity(id: "404") { __typename }
    }`,
    variableValues: { a: 2, b: 3 },
    contextValue: { requestId: 'local-docs' },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    data: {
      addTwoNumbers: 5,
      dog: { __typename: 'Dog', id: '1' },
      cat: { __typename: 'Cat', id: '2' },
      alien: { __typename: 'Alien', id: '3' },
      missing: null,
    },
  });
  const changed = await grafast({
    schema,
    source: '{ addTwoNumbers(a: 8, b: 5) }',
    contextValue: { requestId: 'changed-inputs' },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(changed)), { data: { addTwoNumbers: 13 } });
  console.log(
    'PASS Grafast plans, changed arguments, interface/union resolution, and missing entity',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
