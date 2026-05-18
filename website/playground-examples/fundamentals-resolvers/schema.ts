import SchemaBuilder from '@pothos/core';

interface IBook {
  id: string;
  title: string;
}

const Books = new Map<string, IBook>([
  ['fotr', { id: 'fotr', title: 'The Fellowship of the Ring' }],
  ['ttt', { id: 'ttt', title: 'The Two Towers' }],
]);

const builder = new SchemaBuilder({});

const Book = builder.objectRef<IBook>('Book');

Book.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Sync resolver: just return the value.
    bookCount: t.int({
      resolve: () => Books.size,
    }),

    // Async resolver: return a Promise. Pothos awaits it for you.
    randomBook: t.field({
      type: Book,
      resolve: async () => {
        const list = [...Books.values()];
        return list[Math.floor(Math.random() * list.length)];
      },
    }),

    // Throwing resolver: errors propagate as null for the field and
    // an entry in the response's `errors` array.
    bookById: t.field({
      type: Book,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_root, { id }) => {
        const book = Books.get(String(id));
        if (!book) {
          throw new Error(`No book with id ${id}`);
        }
        return book;
      },
    }),
  }),
});

export const schema = builder.toSchema();
