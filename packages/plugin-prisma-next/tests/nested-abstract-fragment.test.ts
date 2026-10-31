import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { loadContract, run, useDatabase } from './fixtures/helpers';
import type { Contract } from './inheritance/contract';

const contract = loadContract<Contract>(new URL('./inheritance/contract.json', import.meta.url));
const db = useDatabase(
  contract,
  `
  CREATE TABLE user (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE);
  CREATE TABLE task (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, ownerId TEXT NOT NULL, severity TEXT, reviewerId TEXT);
  CREATE TABLE feature (id TEXT PRIMARY KEY REFERENCES task(id), priority INT NOT NULL);
  INSERT INTO user VALUES ('u1', 'a@example.com');
  INSERT INTO task VALUES ('t1', 'bug1', 'bug', 'u1', 'high', 'u1'), ('t2', 'feat1', 'feature', 'u1', NULL, 'u1');
  INSERT INTO feature VALUES ('t2', 5);
`,
);

function schema() {
  const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { client: db.client },
  });
  const task = builder.prismaInterface('Task', {
    fields: (t) => ({ title: t.exposeString('title') }),
  });

  builder.prismaObject('Bug', {
    interfaces: [task],
    fields: (t) => ({ severity: t.exposeString('severity') }),
  });
  builder.prismaNode('Feature', {
    interfaces: [task],
    id: { field: 'id' },
    // A type-level select that the field below reads without a select of its own.
    select: ['priority'],
    fields: (t) => ({
      p: t.int({ resolve: (feature) => (feature as { priority: number }).priority }),
    }),
  });
  builder.queryType({
    fields: (t) => ({
      tasks: t.prismaField({
        type: ['Task'],
        resolve: () => db.orm.Task.orderBy((task) => task.id.asc()),
      }),
    }),
  });

  return builder.toSchema();
}

describe('a variant fragment nested in a fragment on a model-less interface', () => {
  it('plans the variant in the same statement as the direct fragment', async () => {
    const direct = await run(schema(), '{ tasks { ... on Feature { p } } }');
    const nested = await run(schema(), '{ tasks { ... on Node { ... on Feature { p } } } }');

    expect(nested.errors).toBeUndefined();
    expect(nested.data).toEqual(direct.data);
    expect(nested.data).toEqual({ tasks: [{}, { p: 5 }] });
    expect(direct.statements).toHaveLength(1);
    expect(nested.statements).toHaveLength(1);
  });
});
