// Checked by tsconfig.missing-plugins.json alone: importing relay, with-input or scope-auth anywhere
// in the same program would load their global augmentations and enable these methods.
import SchemaBuilder from '@pothos/core';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../../src';
import type { Contract } from '../fixtures/sample-contract';

const relayRequired = '@pothos/plugin-relay is required to use this method';
const withInputRequired = '@pothos/plugin-with-input is required to use this method';
const scopeAuthRequired = '@pothos/plugin-scope-auth is required to use this method';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: null as never },
});

expectTypeOf(builder.prismaNode).toEqualTypeOf<typeof relayRequired>();
// @ts-expect-error prismaNode needs plugin-relay
builder.prismaNode('User', { id: { field: 'id' }, fields: () => ({}) });

builder.prismaObject('User', {
  fields: (t) => {
    expectTypeOf(t.relatedConnection).toEqualTypeOf<typeof relayRequired>();
    expectTypeOf(t.withAuth).toEqualTypeOf<typeof scopeAuthRequired>();
    return {
      // @ts-expect-error relatedConnection needs plugin-relay
      posts: t.relatedConnection('posts', { cursor: 'id' }),
      // @ts-expect-error withAuth needs plugin-scope-auth
      guarded: t.withAuth({ loggedIn: true }).exposeID('id'),
      // Fields that need no other plugin still work.
      id: t.exposeID('id'),
      comments: t.relation('comments'),
    };
  },
});

builder.queryFields((t) => {
  expectTypeOf(t.prismaConnection).toEqualTypeOf<typeof relayRequired>();
  expectTypeOf(t.prismaFieldWithInput).toEqualTypeOf<typeof withInputRequired>();
  return {
    // @ts-expect-error prismaConnection needs plugin-relay
    page: t.prismaConnection({ type: 'User', cursor: 'id', resolve: () => null as never }),
    // @ts-expect-error prismaFieldWithInput needs plugin-with-input
    created: t.prismaFieldWithInput({
      type: 'User',
      input: {},
      resolve: () => null as never,
    }),
  };
});
