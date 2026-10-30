import { readFileSync } from 'node:fs';
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import mysql from '@prisma/orm-mysql/runtime';
import { contractFromJson } from '@prisma/orm-mysql/static';
import { graphql } from 'graphql';
import { createConnection } from 'mariadb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './mysql/contract';

const url = process.env.POTHOS_PRISMA_NEXT_MYSQL_URL;
const contract = contractFromJson<Contract>(
  JSON.parse(readFileSync(new URL('./mysql/contract.json', import.meta.url), 'utf8')),
);

// Prisma's MySQL target is an early preview, so this suite only runs where a server is provided.
describe.skipIf(!url)('MySQL', () => {
  const client = mysql({ contract, url: url ?? 'mysql://unused', verifyMarker: false });

  function createSchema() {
    const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
      plugins: [RelayPlugin, prismaNextPlugin],
      relay: {},
      prismaNext: { contract },
    });
    builder.prismaObject('Author', {
      fields: (t) => ({
        id: t.exposeID('id'),
        name: t.exposeString('name'),
        books: t.relation('books', {
          args: { minPages: t.arg.int() },
          query: (args) => ({
            ...(args.minPages == null
              ? {}
              : { where: (book) => book.pages.gte(args.minPages as number) }),
            orderBy: (book) => book.id.asc(),
          }),
        }),
        // @ts-expect-error MySQL contracts have no aggregates.
        bookCount: t.relationCount('books'),
        // @ts-expect-error MySQL contracts have no aggregates.
        bookTotals: t.relatedConnection('books', { cursor: 'id', totalCount: true }),
        bookPages: t.relatedConnection('books', { cursor: 'id' }),
      }),
    });
    builder.prismaObject('Book', {
      fields: (t) => ({
        id: t.exposeID('id'),
        title: t.exposeString('title'),
        author: t.relation('author'),
      }),
    });
    builder.queryType({
      fields: (t) => ({
        authors: t.prismaField({
          type: ['Author'],
          resolve: () => client.orm.Author.orderBy((author) => author.id.asc()),
        }),
        authorPage: t.prismaConnection({
          type: 'Author',
          cursor: 'id',
          resolve: () => client.orm.Author,
        }),
        authorTotals: t.prismaConnection({
          type: 'Author',
          cursor: 'id',
          // @ts-expect-error MySQL contracts have no aggregates.
          totalCount: true,
          resolve: () => client.orm.Author,
        }),
      }),
    });
    return builder.toSchema();
  }

  beforeAll(async () => {
    const raw = await createConnection((url as string).replace(/^mysql:/, 'mariadb:'));
    await raw.query('DROP TABLE IF EXISTS pothos_next_book, pothos_next_author');
    await raw.query(
      'CREATE TABLE pothos_next_author (id INT PRIMARY KEY, name VARCHAR(255) NOT NULL)',
    );
    await raw.query(`CREATE TABLE pothos_next_book (
      id INT PRIMARY KEY,
      authorId INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      pages INT NOT NULL,
      FOREIGN KEY (authorId) REFERENCES pothos_next_author (id)
    )`);
    await raw.query("INSERT INTO pothos_next_author VALUES (1, 'Ann'), (2, 'Bo')");
    await raw.query(
      "INSERT INTO pothos_next_book VALUES (1, 1, 'A1', 100), (2, 1, 'A2', 300), (3, 2, 'B1', 200)",
    );
    await raw.end();
    await client.connect();
  });

  afterAll(async () => {
    await client.close?.();
  });

  const run = (source: string) => graphql({ schema: createSchema(), source, contextValue: {} });

  it('loads scalars with a relation include and to-one include', async () => {
    const result = await run('{ authors { name books { title author { name } } } }');
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      authors: [
        {
          name: 'Ann',
          books: [
            { title: 'A1', author: { name: 'Ann' } },
            { title: 'A2', author: { name: 'Ann' } },
          ],
        },
        { name: 'Bo', books: [{ title: 'B1', author: { name: 'Bo' } }] },
      ],
    });
  });

  it('combines independent branches of one relation', async () => {
    const result = await run(
      '{ authors { all: books { title } long: books(minPages: 250) { title } } }',
    );
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      authors: [
        {
          all: [{ title: 'A1' }, { title: 'A2' }],
          long: [{ title: 'A2' }],
        },
        { all: [{ title: 'B1' }], long: [] },
      ],
    });
  });

  it('paginates root and related connections', async () => {
    const result = await run(`{
      authorPage(first: 1) {
        pageInfo { hasNextPage }
        edges { node { name bookPages(first: 1) { edges { node { title } } } } }
      }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      authorPage: {
        pageInfo: { hasNextPage: true },
        edges: [
          {
            node: {
              name: 'Ann',
              bookPages: { edges: [{ node: { title: 'A1' } }] },
            },
          },
        ],
      },
    });
  });

  it('reports the missing count aggregate instead of a TypeError', async () => {
    const related = await run('{ authors { bookTotals { totalCount } } }');
    expect(related.errors?.[0]?.message).toMatch(/count aggregate/);
    const root = await run('{ authorTotals { totalCount } }');
    expect(root.errors?.[0]?.message).toMatch(/count aggregate/);
    const relationCount = await run('{ authors { bookCount } }');
    expect(relationCount.errors?.[0]?.message).toMatch(/Aggregate 'count' is not available/);
  });

  it('pages backward within each parent', async () => {
    const result = await run(`{
      authors { bookPages(last: 1) { edges { node { title } } pageInfo { hasPreviousPage } } }
    }`);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      authors: [
        { bookPages: { edges: [{ node: { title: 'A2' } }], pageInfo: { hasPreviousPage: true } } },
        { bookPages: { edges: [{ node: { title: 'B1' } }], pageInfo: { hasPreviousPage: false } } },
      ],
    });
  });
});
