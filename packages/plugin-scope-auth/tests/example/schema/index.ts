import builder from '../builder';

builder.queryType({
  // Scope map describing scopes for any fields on the Query type
  // All Query fields require the user to be logged in
  authScopes: {
    loggedIn: true,
  },
  fields: (t) => ({
    memberMessage: t.string({
      // Scope map for the memberMessage field.
      authScopes: {
        // resolved if the request has any of the following scopes
        // This check is in addition to the type level scope requirements
        admin: true,
        deferredAdmin: true,
        // checks cached per request using the name of the scope + the scope parameter.
        // if multiple fields depend on coolPermission("readStuff") the coolPermission
        // scope loader will only be called once.
        coolPermission: 'readStuff',
      },
      resolve: () => 'hi',
    }),
  }),
});

// Using functions with authScope
builder
  .objectRef<{
    title: string;
    content: string;
    viewCount: number;
    author: { id: number };
    isDraft: () => boolean;
  }>('Article')
  .implement({
    authScopes: (article, context) => {
      if (article.isDraft()) {
        // Draft articles can only be read by admins
        return {
          admin: true,
        };
      }

      // normal articles can be read by admins and users with the 'readStuff' permission
      return {
        admin: true,
        coolPermission: 'readStuff',
      };
    },
    fields: (t) => ({
      title: t.exposeString('title', {}),
      content: t.exposeString('content', {}),
      viewCount: t.exposeInt('viewCount', {
        // Only admins and authors can view this
        // using a function allows you to customize the auth parameters based on parent, args, context or info
        authScopes: (article, args, context, info) => {
          if (context.User.id === article.author.id) {
            // If user is author, let them see it
            // returning a boolean lets you set auth without specifying other scopes to check
            return true;
          }

          // If the user is not the author, require the admin scope
          return {
            admin: true,
          };
        },
      }),
    }),
  });

export default builder.toSchema({});
