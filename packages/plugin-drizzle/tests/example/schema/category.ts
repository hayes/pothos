import { eq } from 'drizzle-orm';
import { builder } from '../builder';
import { db } from '../db';
import { categories } from '../db/schema';

const Category = builder.drizzleObject('categories', {
  name: 'Category',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.mutationFields((t) => ({
  deleteCategory: t.drizzleField({
    type: ['categories'],
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args) => {
      // Delete and return the deleted records
      const result = await db
        .delete(categories)
        .where(eq(categories.name, args.name))
        .returning();
      
      // The result should have all the data needed
      // But the ModelLoader will try to re-query it anyway
      return result;
    },
  }),
  createCategory: t.drizzleField({
    type: 'categories',
    args: {
      name: t.arg.string({ required: true }),
    },
    resolve: async (query, _root, args) => {
      const result = await db
        .insert(categories)
        .values({
          name: args.name,
        })
        .returning();
      
      return result[0];
    },
  }),
}));

export { Category };
