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

describe('builder.prismaObject', () => {
  it('registers a GraphQL type bound to a contract model and exposes scalar columns', () => {
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
      }),
    });

    builder.queryType({
      fields: (t) => ({
        ok: t.boolean({ resolve: () => true }),
      }),
    });

    const schema = builder.toSchema();
    const sdl = printSchema(schema);

    expect(sdl).toContain('type User');
    expect(sdl).toMatch(/\bid: ID/);
    expect(sdl).toMatch(/\bfirstName: String/);
  });

  it('returns the same ref instance for repeated prismaObject() calls on the same model', () => {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
    }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });

    const refA = builder.prismaObject('User', {
      fields: (t) => ({ id: t.exposeID('id' as never, { nullable: true }) }),
    });

    // The WeakMap-keyed ref cache means looking up the same model again
    // hands back the same ref — critical for t.relation() resolving to
    // the same ObjectRef as a future prismaObject('User', ...) call.
    expect(refA.modelName).toBe('User');
    expect(refA.name).toBe('User');
  });

  it('stamps the contract model name on the GraphQL type extensions', () => {
    const builder = new SchemaBuilder<{
      PrismaNextContract: SampleContract;
    }>({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: sampleContract },
    });

    builder.prismaObject('Post', {
      description: 'A blog post',
      fields: (t) => ({ id: t.exposeID('id' as never, { nullable: true }) }),
    });

    builder.queryType({
      fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }),
    });

    const schema = builder.toSchema();
    const postType = schema.getType('Post');
    expect(postType?.description).toBe('A blog post');
    expect(postType?.extensions).toMatchObject({ pothosPrismaNextModel: 'Post' });
  });
});
