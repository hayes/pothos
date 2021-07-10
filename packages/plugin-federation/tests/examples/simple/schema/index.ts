import builder from '../builder';

class Review {
  productUpc!: string;
  authorId!: string;
  authorEmail!: string;
  id!: string;
  body!: string;

  static loadById(id: string): Promise<Review> {
    throw new Error('Not implemented');
  }
}

const Product = builder.externalEntity('Product', {
  key: builder.selection<{ upc: string }>('upc'),
  externalFields: (t) => ({
    upc: t.string(),
  }),
});

const User = builder.externalEntity('User', {
  key: [builder.selection<{ email: string }>('email'), builder.selection<{ id: string }>('id')],
  externalFields: (t) => ({
    email: t.string(),
    id: t.id(),
  }),
  fields: (t) => ({
    emailDomain: t.string({
      requires: builder.selection<{ email: string }>('email'),
      resolve: (user) => user.email.split('@')[1],
    }),
  }),
});

builder.entity(Review, {
  name: 'Review',
  key: builder.selection<{ id: string }>('id'),
  resolveReference: (review) => Review.loadById(review.id),
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body', { nullable: true }),
    author: t.field({
      type: User,
      provides: builder.selection<{ emailDomain: string }>('emailDomain'),
      resolve: (review) => ({
        __typename: 'User' as const,
        email: review.authorEmail,
        emailDomain: review.authorEmail.split('@')[1],
      }),
    }),
    product: t.field({
      type: Product,
      resolve: (review) => ({ __typename: 'Product' as const, upc: review.productUpc }),
    }),
  }),
});

export default builder.toSchema({});
