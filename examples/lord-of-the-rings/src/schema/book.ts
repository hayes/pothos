import { builder } from '../builder.ts';
import {
  Books,
  Chapters,
  Characters,
  chaptersForBook,
  type IBook,
  type IChapter,
  type IQuote,
  Quotes,
  quotesForChapter,
} from '../data/canon.ts';
import { Character } from './character.ts';

// ---------------------------------------------------------------------------
// Book
// ---------------------------------------------------------------------------

export const Book = builder.objectRef<IBook>('Book');

Book.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    publishedYear: t.exposeInt('publishedYear'),
    chapters: t.field({
      type: [Chapter],
      resolve: (book) => chaptersForBook(book.id),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Chapter
// ---------------------------------------------------------------------------

export const Chapter = builder.objectRef<IChapter>('Chapter');

Chapter.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    number: t.exposeInt('number'),
    title: t.exposeString('title'),
    book: t.field({
      type: Book,
      resolve: (ch) => Books.get(ch.bookId)!,
    }),
    quotes: t.field({
      type: [Quote],
      resolve: (ch) => quotesForChapter(ch.id),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Quote
// ---------------------------------------------------------------------------

export const Quote = builder.objectRef<IQuote>('Quote');

Quote.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    text: t.exposeString('text'),
    character: t.field({
      type: Character,
      nullable: true,
      resolve: (q) => (q.characterId ? (Characters.get(q.characterId) ?? null) : null),
    }),
    chapter: t.field({
      type: Chapter,
      nullable: true,
      resolve: (q) => (q.chapterId ? (Chapters.get(q.chapterId) ?? null) : null),
    }),
  }),
});

// ---------------------------------------------------------------------------
// Query entrypoints
// ---------------------------------------------------------------------------

builder.queryFields((t) => ({
  books: t.field({
    type: [Book],
    resolve: () => [...Books.values()],
  }),
  book: t.field({
    type: Book,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Books.get(String(id)) ?? null,
  }),
  quotes: t.field({
    type: [Quote],
    resolve: () => [...Quotes.values()],
  }),
  quote: t.field({
    type: Quote,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Quotes.get(String(id)) ?? null,
  }),
}));
