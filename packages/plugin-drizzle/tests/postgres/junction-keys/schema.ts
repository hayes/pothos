import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { not } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import DrizzlePlugin from '../../../src';
import { type DrizzleRelations, db, editions, relations, tags } from './db';

interface Types {
  DrizzleRelations: DrizzleRelations;
}

const builder = new SchemaBuilder<Types>({
  plugins: [ScopeAuthPlugin, DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
  scopeAuth: { authScopes: () => ({}) },
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    title: t.exposeString('title'),
    relatedTagCount: t.relatedField('tags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { relatedTagCount: (post) => db.$count(tags, buildFilter(post)) },
      }),
      resolve: (post) => post.relatedTagCount,
    }),
    unrelatedTagCount: t.relatedField('tags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { unrelatedTagCount: (post) => db.$count(tags, not(buildFilter(post))) },
      }),
      resolve: (post) => post.unrelatedTagCount,
    }),
    scopedTagCount: t.relatedField('scopedTags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { scopedTagCount: (post) => db.$count(tags, buildFilter(post)) },
      }),
      resolve: (post) => post.scopedTagCount,
    }),
    editionCount: t.relatedCount('editions'),
    editionCodeCount: t.relatedCount('editionCodes'),
    editionSlotCount: t.relatedCount('editionSlots'),
    unrelatedEditionSlotCount: t.relatedField('editionSlots', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: {
          unrelatedEditionSlotCount: (post) => db.$count(editions, not(buildFilter(post))),
        },
      }),
      resolve: (post) => post.unrelatedEditionSlotCount,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    post: t.drizzleField({
      type: 'posts',
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, { id }) => db.query.posts.findFirst(query({ where: { id } })),
    }),
  }),
});

export const schema = builder.toSchema();
