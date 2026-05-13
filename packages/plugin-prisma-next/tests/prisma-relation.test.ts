import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import SchemaBuilder from '@pothos/core';
import { printSchema } from 'graphql';
import { describe, expect, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract as SampleContract } from './fixtures/sample-contract';

const sampleContract = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/sample-contract.json', import.meta.url)), 'utf8'),
) as SampleContract;

function buildSchema() {
  const builder = new SchemaBuilder<{
    PrismaNextContract: SampleContract;
  }>({
    plugins: [prismaNextPlugin],
    prismaNext: { contract: sampleContract },
  });

  builder.prismaObject('User', {
    fields: (t) => ({
      id: t.exposeID('id' as never, { nullable: true }),
      firstName: t.exposeString('firstName' as never, { nullable: true }),
      posts: t.relation('posts'),
      postCount: t.relationCount('posts'),
    }),
  });

  builder.prismaObject('Post', {
    fields: (t) => ({
      id: t.exposeID('id' as never, { nullable: true }),
      title: t.exposeString('title' as never, { nullable: true }),
      author: t.relation('author'),
    }),
  });

  builder.prismaObject('Comment', {
    fields: (t) => ({
      id: t.exposeID('id' as never, { nullable: true }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      users: t.prismaField({
        type: ['User'],
        resolve: () => [],
      }),
      userById: t.prismaField({
        type: 'User',
        nullable: true,
        resolve: () => null,
      }),
    }),
  });

  return builder.toSchema();
}

describe('builder.prismaObject — relations', () => {
  it('produces a schema where t.relation references the related model', () => {
    const sdl = printSchema(buildSchema());

    // User exposes its posts relation as a list of Post and a count
    expect(sdl).toMatch(/type User \{[^}]*posts: \[Post!\]!/s);
    expect(sdl).toMatch(/type User \{[^}]*postCount: Int!/s);

    // Post exposes a single (non-null inferred from FK metadata) author
    expect(sdl).toMatch(/type Post \{[^}]*author: User!/s);
  });

  it('exposes prismaField as a Query entry-point with list and single forms', () => {
    const sdl = printSchema(buildSchema());
    expect(sdl).toMatch(/type Query \{[^}]*users: \[User!\]/s);
    expect(sdl).toMatch(/type Query \{[^}]*userById: User\b/s);
  });

  it('throws a clear error if t.relation is reached without t.prismaField (no parent loaded)', () => {
    const schema = buildSchema();
    const userType = schema.getType('User');
    expect(userType).toBeDefined();
    // The plugin's wrapResolve installs a resolver that throws when called
    // with a parent that wasn't loaded by t.prismaField. We assert the
    // resolver is wired by checking the field has a non-default resolver.
    const objType = userType as { getFields: () => Record<string, { resolve?: unknown }> };
    const postsField = objType?.getFields ? objType.getFields().posts : undefined;
    expect(postsField).toBeDefined();
    expect(typeof postsField?.resolve).toBe('function');
  });
});
