import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});
const Post = builder.objectRef<{ id: string; title: string }>('Post');
Post.implement({ fields: (t) => ({ id: t.exposeID('id'), title: t.exposeString('title') }) });
const User = builder.objectRef<{ id: string; name: string }>('User');
User.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    posts: t.field({ type: [Post], resolve: () => [{ id: 'post-1', title: 'First post' }] }),
  }),
});
builder.queryType({
  fields: (t) => ({ user: t.field({ type: User, resolve: () => ({ id: '1', name: 'Alex' }) }) }),
});

export const schema = builder.toSchema();
