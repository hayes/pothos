import SchemaBuilder from '@pothos/core';
import { expect, it } from 'vitest';
import prismaNextPlugin from '../src';

it('rejects a contract from a non-SQL family when the schema is built', () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: never }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: { targetFamily: 'mongo' } as never },
  });
  builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
  expect(() => builder.toSchema()).toThrow(/only supports SQL contracts/);
});
