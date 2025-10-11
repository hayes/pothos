---
argument-hint: [test-name] [description]
description: Create a new test file with comprehensive test cases
---

Create a new test file called `$1.test.ts` in the appropriate test directory.

**Test Purpose:** $ARGUMENTS (starting from $2)

## Test File Structure

I'll create a test file following the Pothos testing patterns with emphasis on inline snapshot testing:

1. **Import the schema and test utilities**
   - Import or create the schema to test
   - Import `graphql` for executing queries
   - Import `expect` from vitest

2. **Organize tests with describe blocks**
   - Group related tests together
   - Use descriptive test names that explain what is being tested

3. **Use inline snapshot testing as primary assertion**
   - Use `toMatchInlineSnapshot()` instead of `toMatchSnapshot()`
   - Inline snapshots keep test data in the test file itself
   - Snapshot the full result EARLY (right after execution)
   - This makes test failures easy to understand by showing the complete response
   - Snapshots include all data, so additional assertions are usually unnecessary
   - Only add specific assertions for critical runtime validation not visible in snapshots

4. **Write comprehensive test cases**
   - Test success cases
   - Test error cases
   - Test edge cases
   - Test all union type members

## Test Pattern

**Standard test structure:**
```typescript
import { execute, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { builder } from './example/builder';
import { createSchema } from './example/schema';

const schema = createSchema(builder);

describe('feature name', () => {
  it('describes what is being tested', async () => {
    const result = await execute({
      schema,
      document: parse(`
        query TestQuery($arg: String!) {
          field(arg: $arg) {
            __typename
            ... on SuccessType {
              data
            }
            ... on ErrorType {
              message
            }
          }
        }
      `),
      variableValues: { arg: 'value' },
    });

    expect(result).toMatchInlineSnapshot();
  });
});
```

**Key principles:**
- Use inline snapshots (not separate snapshot files)
- Snapshot first (often the only assertion needed)
- Include `__typename` in queries to verify union resolution
- Use descriptive test names
- Test each path through the resolver
- Keep tests simple - snapshots show everything

Now I'll create the test file with comprehensive inline snapshot-first test cases.
