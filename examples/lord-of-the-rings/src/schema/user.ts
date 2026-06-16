import { builder } from '../builder.ts';
import { Books, Characters, Items, Locations, Quotes } from '../data/canon.ts';
import {
  Annotations,
  annotationsForUser,
  Favorites,
  type FavoriteTarget,
  favoritesForUser,
  type IAnnotation,
  type IFavorite,
  type IReadingList,
  type IUser,
  nextId,
  ReadingLists,
  readingListsForUser,
  Users,
} from '../data/users.ts';
import { Book, Quote } from './book.ts';
import { Character } from './character.ts';
import { Item } from './item.ts';
import { Location } from './location.ts';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const FavoriteTargetType = builder.enumType('FavoriteTargetType', {
  values: ['Character', 'Location', 'Item', 'Quote'] as const,
});

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------

export const User = builder.objectRef<IUser>('User');

User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    username: t.exposeString('username'),
    displayName: t.exposeString('displayName'),
    favorites: t.field({
      type: [Favorite],
      resolve: (u) => favoritesForUser(u.id),
    }),
    readingLists: t.field({
      type: [ReadingList],
      resolve: (u) => readingListsForUser(u.id),
    }),
    annotations: t.field({
      type: [Annotation],
      resolve: (u) => annotationsForUser(u.id),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Favorite
// ---------------------------------------------------------------------------

export const Favorite = builder.objectRef<IFavorite>('Favorite');

Favorite.implement({
  description:
    'A user-saved pointer to a Character, Location, Item, or Quote. Exactly one of `character` / `location` / `item` / `quote` is populated, matching `targetType`.',
  fields: (t) => ({
    id: t.exposeID('id'),
    targetType: t.field({
      type: FavoriteTargetType,
      resolve: (f) => f.targetType,
    }),
    user: t.field({
      type: User,
      resolve: (f) => Users.get(f.userId)!,
    }),
    character: t.field({
      type: Character,
      nullable: true,
      resolve: (f) => (f.targetType === 'Character' ? (Characters.get(f.targetId) ?? null) : null),
    }),
    location: t.field({
      type: Location,
      nullable: true,
      resolve: (f) => (f.targetType === 'Location' ? (Locations.get(f.targetId) ?? null) : null),
    }),
    item: t.field({
      type: Item,
      nullable: true,
      resolve: (f) => (f.targetType === 'Item' ? (Items.get(f.targetId) ?? null) : null),
    }),
    quote: t.field({
      type: Quote,
      nullable: true,
      resolve: (f) => (f.targetType === 'Quote' ? (Quotes.get(f.targetId) ?? null) : null),
    }),
  }),
});

// ---------------------------------------------------------------------------
// ReadingList
// ---------------------------------------------------------------------------

export const ReadingList = builder.objectRef<IReadingList>('ReadingList');

ReadingList.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    user: t.field({
      type: User,
      resolve: (rl) => Users.get(rl.userId)!,
    }),
    books: t.field({
      type: [Book],
      resolve: (rl) => rl.bookIds.map((id) => Books.get(id)).filter((b) => Boolean(b)) as never,
    }),
  }),
});

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

export const Annotation = builder.objectRef<IAnnotation>('Annotation');

Annotation.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    text: t.exposeString('text'),
    user: t.field({
      type: User,
      resolve: (a) => Users.get(a.userId)!,
    }),
    quote: t.field({
      type: Quote,
      resolve: (a) => Quotes.get(a.quoteId)!,
    }),
  }),
});

// ---------------------------------------------------------------------------
// Query entrypoints
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  me: t.field({
    type: User,
    nullable: true,
    resolve: (_root, _args, ctx) => (ctx.userId ? (Users.get(ctx.userId) ?? null) : null),
  }),
  user: t.field({
    type: User,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Users.get(String(id)) ?? null,
  }),
}));

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function requireUser(ctx: { userId?: string }): IUser {
  if (!ctx.userId) {
    throw new Error('Not authenticated.');
  }
  const user = Users.get(ctx.userId);
  if (!user) {
    throw new Error(`Unknown user: ${ctx.userId}`);
  }
  return user;
}

function validateFavoriteTarget(targetType: FavoriteTarget, targetId: string): void {
  const lookup = {
    Character: Characters,
    Location: Locations,
    Item: Items,
    Quote: Quotes,
  }[targetType];
  if (!lookup.has(targetId)) {
    throw new Error(`No ${targetType} found with id "${targetId}".`);
  }
}

builder.mutationFields((t) => ({
  addFavorite: t.field({
    type: Favorite,
    args: {
      targetType: t.arg({ type: FavoriteTargetType, required: true }),
      targetId: t.arg.id({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      const user = requireUser(ctx);
      const targetId = String(args.targetId);
      validateFavoriteTarget(args.targetType, targetId);

      const existing = [...Favorites.values()].find(
        (f) => f.userId === user.id && f.targetType === args.targetType && f.targetId === targetId,
      );
      if (existing) {
        return existing;
      }

      const fav: IFavorite = {
        id: nextId('fav'),
        userId: user.id,
        targetType: args.targetType,
        targetId,
      };
      Favorites.set(fav.id, fav);
      return fav;
    },
  }),

  removeFavorite: t.boolean({
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, args, ctx) => {
      const user = requireUser(ctx);
      const id = String(args.id);
      const fav = Favorites.get(id);
      if (!fav || fav.userId !== user.id) {
        return false;
      }
      return Favorites.delete(id);
    },
  }),

  createReadingList: t.field({
    type: ReadingList,
    args: {
      name: t.arg.string({ required: true }),
      bookIds: t.arg.idList(),
    },
    resolve: (_root, args, ctx) => {
      const user = requireUser(ctx);
      const bookIds = (args.bookIds ?? []).map(String);
      for (const id of bookIds) {
        if (!Books.has(id)) {
          throw new Error(`No book with id "${id}".`);
        }
      }
      const rl: IReadingList = {
        id: nextId('rl'),
        userId: user.id,
        name: args.name,
        bookIds,
      };
      ReadingLists.set(rl.id, rl);
      return rl;
    },
  }),

  addBookToReadingList: t.field({
    type: ReadingList,
    args: {
      listId: t.arg.id({ required: true }),
      bookId: t.arg.id({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      const user = requireUser(ctx);
      const listId = String(args.listId);
      const bookId = String(args.bookId);
      const list = ReadingLists.get(listId);
      if (!list) {
        throw new Error(`No reading list with id "${listId}".`);
      }
      if (list.userId !== user.id) {
        throw new Error('This reading list does not belong to you.');
      }
      if (!Books.has(bookId)) {
        throw new Error(`No book with id "${bookId}".`);
      }
      if (!list.bookIds.includes(bookId)) {
        list.bookIds.push(bookId);
      }
      return list;
    },
  }),

  addAnnotation: t.field({
    type: Annotation,
    args: {
      quoteId: t.arg.id({ required: true }),
      text: t.arg.string({ required: true }),
    },
    resolve: (_root, args, ctx) => {
      const user = requireUser(ctx);
      const quoteId = String(args.quoteId);
      if (!Quotes.has(quoteId)) {
        throw new Error(`No quote with id "${quoteId}".`);
      }
      const a: IAnnotation = {
        id: nextId('a'),
        userId: user.id,
        quoteId,
        text: args.text,
      };
      Annotations.set(a.id, a);
      return a;
    },
  }),
}));
