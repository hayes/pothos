import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { execute, parse } from 'graphql';
import { expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { CursorValueCodec } from '../src/utils/cursors';
import { idKeyFromParsed, idKeyFromRow } from '../src/utils/node-batch';

const contract = JSON.parse(
  readFileSync(new URL('./fixtures/sample-contract.json', import.meta.url), 'utf8'),
);

import type { SampleContract } from './fixtures/runtime';

async function roundTrip(
  row: Record<string, unknown>,
  fields: string[],
  codecs?: Record<string, CursorValueCodec>,
  parseId?: (id: string) => unknown,
  extraRows: Record<string, unknown>[] = [],
) {
  const compared: unknown[] = [];
  const col = {
    in(values: unknown[]) {
      compared.push(...values);
      return {};
    },
    eq(value: unknown) {
      compared.push(value);
      return {};
    },
  };
  const collection = {
    select() {
      return this;
    },
    include() {
      return this;
    },
    where(fn: (accessor: Record<string, typeof col>) => unknown) {
      fn(Object.fromEntries(fields.map((field) => [field, col])));
      return this;
    },
    all() {
      return Promise.resolve([row, ...extraRows]);
    },
  };
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: contract as SampleContract },
  });
  const ref = builder.prismaNode('User', {
    id: { field: fields.length === 1 ? fields[0] : fields, codecs, parse: parseId },
    collection,
    fields: (t: { exposeString(name: string): unknown }) => ({
      firstName: t.exposeString('firstName'),
    }),
  } as never);
  builder.queryType({
    fields: (t) => ({
      person: t.field({ type: ref, resolve: () => row as never }),
      others: t.field({ type: [ref], resolve: () => extraRows as never }),
    }),
  });
  const schema = builder.toSchema();
  const first = await execute({
    schema,
    contextValue: {},
    document: parse('{ person { id } others { id } }'),
  });
  expect(first.errors).toBeUndefined();
  const id = (first.data as { person: { id: string } }).person.id;
  const extraIds = (first.data as { others: { id: string }[] }).others.map((other) => other.id);
  const loaded = await execute({
    schema,
    contextValue: {},
    document: parse('query($ids: [ID!]!) { nodes(ids: $ids) { ... on User { firstName } } }'),
    variableValues: { ids: [id, ...extraIds] },
  });
  expect(loaded.errors).toBeUndefined();
  expect(loaded.data).toEqual({
    nodes: [row, ...extraRows].map((value) => ({ firstName: value.firstName })),
  });
  return compared;
}

it('round trips a numeric node ID as a number', async () => {
  expect(await roundTrip({ id: 42, firstName: 'Alice' }, ['id'])).toEqual([42]);
});

it('preserves bigint and Date in a composite node ID and batching key', async () => {
  const row = {
    id: BigInt('9007199254740993'),
    email: new Date('2026-09-10T01:02:03.456Z'),
    firstName: 'Alice',
  };
  const compared = await roundTrip(row, ['id', 'email']);
  expect(compared).toEqual([row.id, row.email]);
  expect(compared[1]).toBeInstanceOf(Date);
  expect(idKeyFromRow(row, ['id', 'email'])).toBe(idKeyFromParsed(compared, ['id', 'email']));
});

it('round trips a scalar node ID through its explicit codec', async () => {
  class PreciseTimestamp {
    constructor(readonly text: string) {}
    toString() {
      return this.text;
    }
  }
  const value = new PreciseTimestamp('2026-09-10T01:02:03.123456789Z');
  const compared = await roundTrip({ id: value, firstName: 'Alice' }, ['id'], {
    id: { encode: (v: PreciseTimestamp) => v.text, decode: (s: string) => new PreciseTimestamp(s) },
  });
  expect(compared[0]).toBeInstanceOf(PreciseTimestamp);
  expect(String(compared[0])).toBe(value.text);
});

it('escapes a string ID that starts with the typed payload prefix', async () => {
  expect(await roundTrip({ id: 'PNI:N:42', firstName: 'Alice' }, ['id'])).toEqual(['PNI:N:42']);
});

it('preserves the raw scalar format when the node declares a custom parser', async () => {
  expect(await roundTrip({ id: 42, firstName: 'Alice' }, ['id'], undefined, Number)).toEqual([42]);
});

it('matches custom scalar node IDs using the codec instead of Object.toString', async () => {
  const compared = await roundTrip(
    { id: { text: 'first' }, firstName: 'Alice' },
    ['id'],
    {
      id: { encode: (value: { text: string }) => value.text, decode: (text: string) => ({ text }) },
    },
    undefined,
    [{ id: { text: 'second' }, firstName: 'Bob' }],
  );
  expect(compared).toEqual([{ text: 'first' }, { text: 'second' }]);
});

it('rejects malformed scalar ID codec values before running the collection', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: contract as SampleContract },
  });
  builder.prismaNode('User', {
    id: {
      field: 'id',
      codecs: {
        id: {
          encode: String,
          decode: (id: string) => {
            throw new Error(`Private payload: ${id}`);
          },
        },
      },
    },
    collection: () => {
      throw new Error('The query should not run');
    },
    fields: (t) => ({ firstName: t.exposeString('firstName') }),
  });
  builder.queryType({});
  const result = await execute({
    schema: builder.toSchema(),
    contextValue: {},
    document: parse('query($id: ID!) { node(id: $id) { id } }'),
    variableValues: { id: Buffer.from('User:private-value').toString('base64') },
  });
  expect(result.errors?.[0].message).toBe("prismaNode 'User' ID has an invalid id value.");
});

it('requires a codec instead of silently serializing a custom scalar ID as JSON', async () => {
  const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
    plugins: [RelayPlugin, prismaNextPlugin],
    relay: {},
    prismaNext: { contract: contract as SampleContract },
  });
  const ref = builder.prismaNode('User', {
    id: { field: 'id' },
    collection: () => {
      throw new Error('The query should not run');
    },
    fields: (t) => ({ firstName: t.exposeString('firstName') }),
  });
  builder.queryType({
    fields: (t) => ({
      person: t.field({ type: ref, resolve: () => ({ id: { value: 'opaque' } }) as never }),
    }),
  });
  const result = await execute({
    schema: builder.toSchema(),
    contextValue: {},
    document: parse('{ person { id } }'),
  });
  expect(result.errors?.[0].message).toBe(
    "prismaNode 'User' requires an id.codecs entry for custom scalar field 'id'.",
  );
});
