import SchemaBuilder from '@pothos/core';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';
import { not } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin from '../../src';
import { type DrizzleRelations, db, editions, labels, relations, tags } from './db';

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
    staticRawTagCount: t.relatedField('staticRawTags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { staticRawTagCount: (post) => db.$count(tags, buildFilter(post)) },
      }),
      resolve: (post) => post.staticRawTagCount,
    }),
    unrelatedStaticRawTagCount: t.relatedField('staticRawTags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { unrelatedStaticRawTagCount: (post) => db.$count(tags, not(buildFilter(post))) },
      }),
      resolve: (post) => post.unrelatedStaticRawTagCount,
    }),
    callbackRawTagCount: t.relatedField('callbackRawTags', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { callbackRawTagCount: (post) => db.$count(tags, buildFilter(post)) },
      }),
      resolve: (post) => post.callbackRawTagCount,
    }),
    numericCodeCount: t.relatedField('numericCodes', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { numericCodeCount: (post) => db.$count(tags, buildFilter(post)) },
      }),
      resolve: (post) => post.numericCodeCount,
    }),
    unrelatedNumericCodeCount: t.relatedField('numericCodes', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { unrelatedNumericCodeCount: (post) => db.$count(tags, not(buildFilter(post))) },
      }),
      resolve: (post) => post.unrelatedNumericCodeCount,
    }),
    editionCount: t.relatedCount('editions'),
    editionCodeCount: t.relatedCount('editionCodes'),
    editionSlotCount: t.relatedCount('editionSlots'),
    relatedLabelCount: t.relatedField('labels', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { relatedLabelCount: (post) => db.$count(labels, buildFilter(post)) },
      }),
      resolve: (post) => post.relatedLabelCount,
    }),
    unrelatedLabelCount: t.relatedField('labels', {
      type: 'Int',
      select: (buildFilter) => ({
        extras: { unrelatedLabelCount: (post) => db.$count(labels, not(buildFilter(post))) },
      }),
      resolve: (post) => post.unrelatedLabelCount,
    }),
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
