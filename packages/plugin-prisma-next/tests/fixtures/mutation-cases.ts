import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';
import type postgres from '@prisma/orm-postgres/runtime';
import { graphql } from 'graphql';
import type { Client } from 'pg';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../../src';
import type { Contract } from '../postgres/contract';

type TestClient = ReturnType<typeof postgres<Contract>>;

// Registered inside the PostgreSQL suite so it owns setup and cleanup once.
export function mutationCases(client: TestClient, raw: Client, contract: Contract) {
  function createSchema() {
    const events: string[] = [];
    let providerCalls = 0;
    const builder = new SchemaBuilder<{
      PrismaNextContract: Contract;
      Context: { orm: typeof client.orm };
    }>({
      plugins: [prismaNextPlugin, WithInputPlugin],
      prismaNext: {
        contract,
        collections: (context) => {
          providerCalls += 1;
          return { Account: context.orm.public.Account, Entry: context.orm.public.Entry };
        },
      },
    });
    builder.prismaObject('Account', {
      fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        entries: t.relation('entries', { query: { orderBy: (entry) => entry.id.asc() } }),
        completedName: t.string({
          select: ['name'],
          resolve: async (account) => {
            await Promise.resolve();
            events.push(`completed:${account.name}`);
            return account.name;
          },
        }),
        fail: t.string({
          nullable: false,
          resolve: () => {
            throw new Error('mutation result failed');
          },
        }),
      }),
    });
    builder.prismaObject('Entry', {
      fields: (t) => ({
        id: t.exposeID('id'),
        original: t.relation('account', { nullable: true, query: { where: { name: 'Alice' } } }),
        current: t.relation('account'),
      }),
    });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.mutationType({
      fields: (t) => ({
        createAccount: t.prismaField({
          type: 'Account',
          nullable: false,
          args: { id: t.arg.string({ required: true }), name: t.arg.string({ required: true }) },
          resolve: async (_root, args, context) => {
            await context.orm.public.Account.create(args);
            return context.orm.public.Account.where({ id: args.id });
          },
        }),
        rename: t.prismaFieldWithInput({
          type: 'Account',
          nullable: false,
          input: { name: t.input.string({ required: true }) },
          resolve: async (_root, args, context) => {
            events.push(`write:${args.input.name}`);
            await context.orm.public.Account.where({ id: 'a' }).update({ name: args.input.name });
            return context.orm.public.Account.where({ id: 'a' });
          },
        }),
        closedTransaction: t.prismaField({
          type: 'Account',
          nullable: true,
          resolve: () => client.transaction(async (tx) => tx.orm.public.Account.where({ id: 'a' })),
        }),
        missing: t.prismaField({
          type: 'Account',
          nullable: true,
          resolve: (_root, _args, context) => context.orm.public.Account.where({ id: 'absent' }),
        }),
      }),
    });
    return { schema: builder.toSchema(), events, providerCalls: () => providerCalls };
  }

  describe('GraphQL mutation results', () => {
    it('creates through prismaField and commits only after completing the selected result', async () => {
      const { schema } = createSchema();
      try {
        const result = await client.transaction((tx) =>
          graphql({
            schema,
            source:
              'mutation { createAccount(id: "mutation-created", name: "Created") { id name entries { id } } missing { id } }',
            contextValue: { orm: tx.orm },
          }),
        );
        expect(result.errors).toBeUndefined();
        expect(result.data).toEqual({
          createAccount: { id: 'mutation-created', name: 'Created', entries: [] },
          missing: null,
        });
        expect(
          (
            await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', [
              'mutation-created',
            ])
          ).rows,
        ).toEqual([{ name: 'Created' }]);
      } finally {
        await raw.query('DELETE FROM pothos_next_account WHERE id = $1', ['mutation-created']);
      }
    });

    it('completes serial input mutations and nested fallback reads before the next write', async () => {
      const fixture = createSchema();
      const rollback = new Error('rollback serial mutation fixture');
      await expect(
        client.transaction(async (tx) => {
          const result = await graphql({
            schema: fixture.schema,
            source: `mutation {
            first: rename(input: { name: "First" }) { completedName entries { original { name } current { name } } }
            second: rename(input: { name: "Second" }) { completedName entries { original { name } current { name } } }
          }`,
            contextValue: { orm: tx.orm },
          });
          expect(result.errors).toBeUndefined();
          expect(result.data).toEqual({
            first: {
              completedName: 'First',
              entries: [
                { original: null, current: { name: 'First' } },
                { original: null, current: { name: 'First' } },
              ],
            },
            second: {
              completedName: 'Second',
              entries: [
                { original: null, current: { name: 'Second' } },
                { original: null, current: { name: 'Second' } },
              ],
            },
          });
          expect(fixture.events).toEqual([
            'write:First',
            'completed:First',
            'write:Second',
            'completed:Second',
          ]);
          expect(fixture.providerCalls()).toBe(2);
          // An independent connection cannot see either uncommitted mutation.
          expect(
            (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
          ).toEqual([{ name: 'Alice' }]);
          throw rollback;
        }),
      ).rejects.toBe(rollback);
      expect(
        (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
      ).toEqual([{ name: 'Alice' }]);
    });

    it('rejects a Collection whose resolver already ended its transaction', async () => {
      const { schema } = createSchema();
      const result = await graphql({
        schema,
        source: 'mutation { closedTransaction { name entries { current { name } } } }',
        contextValue: { orm: client.orm },
      });
      expect(result.data).toEqual({ closedTransaction: null });
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].path).toEqual(['closedTransaction']);
      expect(result.errors?.[0].message).toMatch(/transaction|committed|closed/i);
    });

    it('lets the application roll back writes when GraphQL reports a result-field error', async () => {
      const { schema, events } = createSchema();
      await expect(
        client.transaction(async (tx) => {
          const result = await graphql({
            schema,
            source:
              'mutation { rename(input: { name: "Rollback" }) { name fail } later: rename(input: { name: "Must not run" }) { name } }',
            contextValue: { orm: tx.orm },
          });
          expect(result.data).toBeNull();
          expect(result.errors).toHaveLength(1);
          expect(result.errors?.[0].path).toEqual(['rename', 'fail']);
          // graphql() resolves with errors; throwing is the caller's rollback policy.
          throw result.errors?.[0];
        }),
      ).rejects.toThrow('mutation result failed');
      expect(events).toEqual(['write:Rollback']);
      expect(
        (await raw.query('SELECT name FROM pothos_next_account WHERE id = $1', ['a'])).rows,
      ).toEqual([{ name: 'Alice' }]);
    });
  });
}
