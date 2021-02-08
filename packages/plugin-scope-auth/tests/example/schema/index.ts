import builder from '../builder';

builder.queryType({
  fields: (t) => ({
    forAdmin: t.string({
      authScopes: {
        admin: true,
      },
      resolve: () => 'ok',
    }),
    forDeferredAdmin: t.string({
      authScopes: {
        deferredAdmin: true,
      },
      resolve: () => 'ok',
    }),
    forPermission: t.string({
      authScopes: {
        hasPermission: 'a',
      },
      resolve: () => 'ok',
    }),
    forAll: t.string({
      authScopes: {
        // TODO should all prevent use of other permissions in same object?
        $all: {
          admin: true,
          hasPermission: 'a',
        },
      },
      resolve: () => 'ok',
    }),
    forAny: t.string({
      authScopes: {
        $any: {
          admin: true,
          hasPermission: 'a',
        },
      },
      resolve: () => 'ok',
    }),
  }),
});

// // Using functions with authScope
// builder
//   .objectRef<{
//     title: string;
//     content: string;
//     viewCount: number;
//     author: { id: number };
//     isDraft: () => boolean;
//   }>('Article')
//   .implement({
//     authScopes: (article, context) => {
//       if (article.isDraft()) {
//         // Draft articles can only be read by admins
//         return {
//           admin: true,
//         };
//       }

//       // normal articles can be read by admins and users with the 'readStuff' permission
//       return {
//         admin: true,
//         coolPermission: 'readStuff',
//       };
//     },
//     fields: (t) => ({
//       title: t.exposeString('title', {}),
//       content: t.exposeString('content', {}),
//       viewCount: t.exposeInt('viewCount', {
//         // Only admins and authors can view this
//         // using a function allows you to customize the auth parameters based on parent, args, context or info
//         authScopes: (article, args, context, info) => {
//           if (context.User.id === article.author.id) {
//             // If user is author, let them see it
//             // returning a boolean lets you set auth without specifying other scopes to check
//             return true;
//           }

//           // If the user is not the author, require the admin scope
//           return {
//             admin: true,
//           };
//         },
//       }),
//     }),
//   });

export default builder.toSchema({});
