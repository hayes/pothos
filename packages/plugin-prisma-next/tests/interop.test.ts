import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import WithInputPlugin from '@pothos/plugin-with-input';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import { createBuilder, run, type SampleContract, useSampleDb } from './fixtures/helpers';

const db = useSampleDb();

describe('plugin-with-input', () => {
  it('passes the input to prismaFieldWithInput, or undefined when an optional input is omitted', async () => {
    const seen: unknown[] = [];
    const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
      plugins: [WithInputPlugin, prismaNextPlugin],
      prismaNext: { client: db.client },
    });
    builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id'), firstName: t.exposeString('firstName') }),
    });
    builder.queryType({
      fields: (t) => ({
        byEmail: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          input: { email: t.input.string({ required: true }) },
          resolve: (_root, args) => db.orm.User.where({ email: args.input.email }),
        }),
        optional: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          argOptions: { required: false },
          input: { email: t.input.string({ required: true }) },
          resolve: (_root, args) => {
            seen.push(args.input);
            return db.orm.User.where({ email: args.input?.email ?? 'alice@example.com' });
          },
        }),
      }),
    });
    const schema = builder.toSchema();
    const result = await run(
      schema,
      '{ byEmail(input: { email: "bob@example.com" }) { id firstName } omitted: optional { id } explicit: optional(input: null) { id } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      byEmail: { id: 'u-bob', firstName: 'Bob' },
      omitted: { id: 'u-alice' },
      explicit: { id: 'u-alice' },
    });
    expect(seen).toEqual([undefined, null]);
  });
});

describe('plugin-errors', () => {
  it('forwards errors options through t.relation', () => {
    const builder = createBuilder();
    class CustomError extends Error {}
    builder.objectType(CustomError, {
      name: 'CustomError',
      fields: (t) => ({ message: t.exposeString('message') }),
    });
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.prismaObject('Post', {
      fields: (t) => ({ author: t.relation('author', { errors: { types: [CustomError] } }) }),
    });
    builder.queryType({
      fields: (t) => ({ posts: t.prismaField({ type: ['Post'], resolve: () => db.orm.Post }) }),
    });
    const schema = builder.toSchema();
    expect(schema.getType('PostAuthorResult')).toBeDefined();
    expect(schema.getType('PostAuthorSuccess')).toBeDefined();
  });

  it('materializes a list inside a root success wrapper as a list', async () => {
    const builder = createBuilder();
    builder.prismaObject('User', { fields: (t) => ({ id: t.exposeID('id') }) });
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({ type: ['User'], errors: { types: [] }, resolve: () => db.orm.User }),
      }),
    });
    const result = await run(
      builder.toSchema(),
      '{ users { ... on QueryUsersSuccess { data { id } } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({ users: { data: [{ id: 'u-alice' }, { id: 'u-bob' }] } });
  });
});

describe('optional plugins', () => {
  it('imports the built package without plugin-relay or plugin-with-input', () => {
    // CI builds packages before their tests; the CommonJS entry point runs in its own process.
    const entry = fileURLToPath(new URL('../lib/index.js', import.meta.url));
    const output = execFileSync(
      process.execPath,
      [
        '-e',
        `
        const Module = require('node:module');
        const load = Module._load;
        Module._load = function (name, ...args) {
          if (name === '@pothos/plugin-relay' || name === '@pothos/plugin-with-input') {
            throw new Error('Optional plugin imported: ' + name);
          }
          return load.call(this, name, ...args);
        };
        const plugin = require(process.argv[1]);
        if (plugin.default !== 'prismaNext') throw new Error('Missing plugin export');
        process.stdout.write('ok');
        `,
        entry,
      ],
      { encoding: 'utf8' },
    );
    expect(output).toBe('ok');
  });
});
