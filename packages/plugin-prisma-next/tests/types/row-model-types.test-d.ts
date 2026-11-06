// A row of one model doesn't pass as a row of another whose columns differ. TypeScript compares two
// instantiations of a type alias by their arguments when it can, so a row alias whose model it
// measures as unused would accept any model's row.
import SchemaBuilder from '@pothos/core';
import prismaNextPlugin, {
  type CollectionFor,
  type OwnRow,
  type PrismaNextObjectRef,
  type Row,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

declare const ownUser: OwnRow<Types, 'User'>;
declare const user: Row<Types, 'User'>;
declare const post: Row<Types, 'Post'>;

// @ts-expect-error a User row lacks a Post's columns
export const ownPost: OwnRow<Types, 'Post'> = ownUser;
// @ts-expect-error a User row lacks a Post's columns
export const postRow: Row<Types, 'Post'> = user;
export const samePost: Row<Types, 'Post'> = post;

function title(row: Row<Types, 'Post'>) {
  return row.title;
}
// @ts-expect-error a User row lacks a Post's columns
title(user);
title(post);

// A collection's rows are its model's own rows.
declare const users: CollectionFor<Types, 'User'>;
declare const posts: CollectionFor<Types, 'Post'>;
export async function firstTitles() {
  // @ts-expect-error a User row lacks a Post's columns
  title((await users.all())[0]);
  return title((await posts.all())[0]);
}

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: null as never },
});

// A model without an identity can't be reloaded, so a field returning it needs its whole row.
const PostView = builder.prismaObject('PostView', {
  fields: (t) => ({ viewer: t.exposeString('viewer') }),
});
declare const PostRef: PrismaNextObjectRef<Types, 'Post', Row<Types, 'Post'>>;
declare const postViewRow: Row<Types, 'PostView'>;

builder.queryType({
  fields: (t) => ({
    // @ts-expect-error a User row isn't a PostView row
    view: t.field({ type: PostView, resolve: () => user }),
    ownView: t.field({ type: PostView, resolve: () => postViewRow }),
  }),
});

// @ts-expect-error a User row isn't a PostView row
PostView.addBrand(user);
PostView.addBrand(postViewRow);

// @ts-expect-error a User row lacks a Post's columns
export const inferred: typeof PostRef.$inferType = user;
export const inferredPost: typeof PostRef.$inferType = post;
