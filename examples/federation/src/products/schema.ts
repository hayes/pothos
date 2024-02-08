import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';

export const builder = new SchemaBuilder<{
  Scalars: {
    ID: { Input: string; Output: number | string };
  };
}>({
  plugins: [DirectivesPlugin, FederationPlugin],
});

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  categoryId: string;
}

interface Category {
  id: string;
  title: string;
}

const products: Product[] = [
  {
    id: '1',
    title: 'Blender',
    description: null,
    price: 40,
    categoryId: '2',
  },
];

const categories = [
  {
    id: '2',
    title: 'Kitchen tools',
  },
];

const ProductType = builder.objectRef<Product>('Product').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    description: t.exposeString('description', { nullable: true }),
    price: t.exposeInt('price'),
    category: t.field({
      type: CategoryType,
      nullable: true,
      resolve: (product) => categories.find((category) => category.id === product.categoryId),
    }),
  }),
});

builder.asEntity(ProductType, {
  key: builder.selection<{ id: string }>('id'),
  resolveReference: ({ id }) => products.find((product) => product.id === id),
});

const CategoryType = builder.objectRef<Category>('Category').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
  }),
});

builder.queryType({
  fields: (t) => ({
    product: t.field({
      type: ProductType,
      nullable: true,
      args: { id: t.arg.id({ required: true }) },
      resolve: (_, { id }) => products.find((product) => product.id === id),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
