import { builder } from '../builder';

builder.queryFields((t) => ({
  posts: t.field({
    type: ['Post'],
    resolve: () => [{ id: '123', title: 'title', content: 'content' }],
  }),
}));

export default builder.toSchema();
