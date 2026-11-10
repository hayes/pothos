// Mistyped names. Each line marked `lists:` must fail with a message naming the valid names, and
// each line marked `says:` with a message containing the text.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import DrizzlePlugin, { drizzleConnectionHelpers } from '../../src';
import { type DrizzleRelations, db, relations } from '../example/db';

const builder = new SchemaBuilder<{ DrizzleRelations: DrizzleRelations }>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    name: t.exposeString('nme'), // lists: "username" "firstName" "lastName"
    id: t.exposeInt('nme'), // lists: "id"
    names: t.expose('nme', { type: 'String' }), // lists: "username" "firstName" "lastName"
    postPages: t.relatedConnection('psts'), // lists: "posts" "comments" "roles"
    postCount: t.relatedCount('psts'), // lists: "posts" "comments" "roles"
  }),
});

builder.drizzleObjectFields('usrs', () => ({})); // lists: "users" "posts"

// Without `DrizzleRelations` there are no table names: the error says what to set.
const untyped = new SchemaBuilder<{}>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: { client: () => db, getTableConfig, relations },
});

untyped.drizzleObject('users', { fields: () => ({}) }); // says: Set DrizzleRelations on SchemaTypes
untyped.drizzleObjectFields('users', () => ({})); // says: Set DrizzleRelations on SchemaTypes
drizzleConnectionHelpers(untyped, 'users', {}); // says: Set DrizzleRelations on SchemaTypes
