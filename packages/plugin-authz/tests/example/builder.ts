import '../../src';
import { postExecRule, preExecRule } from '@graphql-authz/core';
import SchemaBuilder from '@pothos/core';
import { posts } from './data';

interface IContext {
  user?: {
    id: string;
    role: string;
  };
}

const IsAuthenticated = preExecRule({
  error: 'User is not authenticated',
})((context: IContext) => !!context.user);

const IsAdmin = preExecRule({
  error: 'User is not admin',
})((context: IContext) => context.user?.role === 'Admin');

const CanReadPost = postExecRule({
  error: 'Access denied',
  selectionSet: '{ status author { id } }',
})(
  (context: IContext, fieldArgs: unknown, post: { status: string; author: { id: string } }) =>
    post.status === 'public' || context.user?.id === post.author.id,
);

const CanPublishPost = preExecRule()(async (context: IContext, fieldArgs: { postId: string }) => {
  const post = await Promise.resolve(posts.find(({ id }) => id === fieldArgs.postId));
  return !post || post.authorId === context.user?.id;
});

export const rules = {
  IsAuthenticated,
  IsAdmin,
  CanReadPost,
  CanPublishPost,
};

export default new SchemaBuilder<{
  AuthZRule: keyof typeof rules;
}>({
  plugins: ['authz'],
});
