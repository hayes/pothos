import SchemaBuilder from '@pothos/core';

// Sample data type
interface Product {
  id: string;
  name: string;
  price: number;
  inStock: boolean;
  tags: string[];
  description: string | null;
}

const builder = new SchemaBuilder<{
  Objects: {
    Product: Product;
  };
}>({});

const products: Product[] = [
  {
    id: '1',
    name: 'Laptop',
    price: 999.99,
    inStock: true,
    tags: ['electronics', 'computers'],
    description: 'Powerful laptop for work and play',
  },
  {
    id: '2',
    name: 'Mouse',
    price: 29.99,
    inStock: true,
    tags: ['electronics', 'accessories'],
    description: null,
  },
];

// Define Product type demonstrating different field methods
builder.objectType('Product', {
  fields: (t) => ({
    // Expose fields directly from the backing type
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    price: t.exposeFloat('price'),
    inStock: t.exposeBoolean('inStock'),

    // Expose lists
    tags: t.exposeStringList('tags'),

    // Nullable fields
    description: t.exposeString('description', { nullable: true }),

    // Field with custom resolver
    displayPrice: t.string({
      resolve: (product) => `$${product.price.toFixed(2)}`,
    }),

    // Field with arguments
    tagMatches: t.boolean({
      args: {
        tag: t.arg.string({ required: true }),
      },
      resolve: (product, { tag }) => product.tags.includes(tag),
    }),

    // List of strings
    relatedTags: t.stringList({
      resolve: (product) => [...product.tags, 'featured', 'new'],
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    id: t.id({ resolve: () => '123' }),
    int: t.int({ resolve: () => 123 }),
    float: t.float({ resolve: () => 1.23 }),
    boolean: t.boolean({ resolve: () => false }),
    string: t.string({ resolve: () => 'abc' }),
    idList: t.idList({ resolve: () => ['123'] }),
    intList: t.intList({ resolve: () => [123] }),
    floatList: t.floatList({ resolve: () => [1.23] }),
    booleanList: t.booleanList({ resolve: () => [false] }),
    stringList: t.stringList({ resolve: () => ['abc'] }),

    // Field returning object type
    product: t.field({
      type: 'Product',
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      resolve: (_parent, { id }) => products.find((p) => p.id === id) || null,
    }),

    // Field returning list
    products: t.field({
      type: ['Product'],
      resolve: () => products,
    }),

    // List field with arguments
    searchProducts: t.field({
      type: ['Product'],
      args: {
        tag: t.arg.string({ required: false }),
      },
      resolve: (_parent, { tag }) => {
        if (tag) {
          return products.filter((p) => p.tags.includes(tag));
        }
        return products;
      },
    }),
  }),
});

export const schema = builder.toSchema();
