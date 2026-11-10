import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { execute } from '@pothos/test-utils';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { gql } from 'graphql-tag';
import DrizzlePlugin from '../src';
import { type DrizzleRelations, db, relations, seed } from './keyless/db';

// `logs` has no primary key. A type-level `select` on it loads what it names, as it does on a
// table with one.
const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [ScopeAuthPlugin, RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
  relay: {},
  scopeAuth: { authScopes: () => ({}) },
});

const Log = builder.drizzleObject('logs', {
  name: 'Log',
  select: { columns: { at: true } },
  fields: (t) => ({
    at: t.exposeString('at'),
    message: t.string({
      select: { columns: { message: true } },
      resolve: (log) => log.message,
    }),
    user: t.relation('user'),
    notes: t.relatedConnection('notes'),
  }),
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    name: t.exposeString('name'),
    logs: t.relation('logs'),
    logsConnection: t.relatedConnection('logs', {
      query: () => ({ orderBy: { at: 'asc' } }),
    }),
  }),
});

builder.drizzleObject('notes', {
  name: 'Note',
  fields: (t) => ({ body: t.exposeString('body') }),
});

builder.queryType({
  fields: (t) => ({
    logs: t.drizzleField({
      type: [Log],
      resolve: (query) => db.query.logs.findMany(query({ orderBy: { at: 'asc' } })),
    }),
    users: t.drizzleField({
      type: ['users'],
      resolve: (query) => db.query.users.findMany(query({ orderBy: { id: 'asc' } })),
    }),
    logsConnection: t.drizzleConnection({
      type: Log,
      resolve: (query) => db.query.logs.findMany(query({ orderBy: { at: 'asc' } })),
    }),
  }),
});

const schema = builder.toSchema();

function run(document: string) {
  return execute({ schema, document: gql(document), contextValue: {} });
}

beforeAll(seed);

describe('a type-level select on a table without a primary key', () => {
  it('loads the selected columns, field selects and relations', async () => {
    const result = await run(`
      {
        logs {
          at
          message
          user { name }
          notes { edges { node { body } } }
        }
      }
    `);

    expect(result).toEqual({
      data: {
        logs: [
          {
            at: '2026-01-01',
            message: 'first',
            user: { name: 'Ada' },
            notes: { edges: [{ node: { body: 'a' } }, { node: { body: 'b' } }] },
          },
          {
            at: '2026-01-02',
            message: 'second',
            user: { name: 'Bob' },
            notes: { edges: [] },
          },
          {
            at: '2026-01-03',
            message: 'third',
            user: { name: 'Ada' },
            notes: { edges: [{ node: { body: 'c' } }] },
          },
        ],
      },
    });
  });

  it('loads the rows as a relation and through connections', async () => {
    const result = await run(`
      {
        users {
          name
          logs { at message }
          logsConnection { edges { node { at } } }
        }
        logsConnection(first: 2) { edges { node { at message } } }
      }
    `);

    expect(result).toEqual({
      data: {
        users: [
          {
            name: 'Ada',
            logs: [
              { at: '2026-01-01', message: 'first' },
              { at: '2026-01-03', message: 'third' },
            ],
            logsConnection: {
              edges: [{ node: { at: '2026-01-01' } }, { node: { at: '2026-01-03' } }],
            },
          },
          {
            name: 'Bob',
            logs: [{ at: '2026-01-02', message: 'second' }],
            logsConnection: { edges: [{ node: { at: '2026-01-02' } }] },
          },
        ],
        logsConnection: {
          edges: [
            { node: { at: '2026-01-01', message: 'first' } },
            { node: { at: '2026-01-02', message: 'second' } },
          ],
        },
      },
    });
  });
});
