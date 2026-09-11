import { describe, expect, it } from 'vitest';
import { typecheckPlaygroundCases } from './type-playground-examples.mjs';

const schema = (content) => ({ filename: 'schema.ts', content });

describe('playground TypeScript programs', () => {
  it('keeps plugin declarations isolated while checking nested bundle files', async () => {
    const count = await typecheckPlaygroundCases([
      {
        id: 'with-plugin',
        bundle: {
          files: [
            schema(`import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { name } from './models/user';
const builder = new SchemaBuilder({ plugins: [ScopeAuthPlugin], scopeAuth: { authScopes: () => ({}) } });
builder.queryType({ fields: (t) => ({ name: t.string({ resolve: () => name }) }) });
export const schema = builder.toSchema();`),
            { filename: 'models/user.ts', content: "export const name = 'Alex';" },
          ],
        },
      },
      {
        id: 'core-only',
        bundle: {
          files: [
            schema(
              "import SchemaBuilder from '@pothos/core'; const builder = new SchemaBuilder({});",
            ),
          ],
        },
      },
    ]);
    expect(count).toBe(3);
  }, 30000);

  it('still rejects a strict type error in a bundle', async () => {
    await expect(
      typecheckPlaygroundCases([
        {
          id: 'invalid',
          bundle: { files: [schema('const count: number = null; export { count };')] },
        },
      ]),
    ).rejects.toThrow(/invalid: TypeScript check failed[\s\S]*TS2322/);
  }, 30000);
});
