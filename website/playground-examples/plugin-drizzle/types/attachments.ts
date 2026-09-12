import { drizzleConnectionHelpers } from '@pothos/plugin-drizzle';
import { builder } from '../builder';
import { Media } from './post';

// #region attachment-helper
const attachmentArgs = builder.args((t) => ({
  hasCaption: t.boolean({ defaultValue: false }),
}));

const attachments = drizzleConnectionHelpers(builder, 'postMedia', {
  args: () => attachmentArgs,
  query: (args) => ({
    orderBy: { id: 'asc' },
    where: args.hasCaption ? { caption: { isNotNull: true } } : {},
  }),
  select: (nestedSelection) => {
    return {
      columns: { caption: true },
      with: { media: nestedSelection() },
    };
  },
  resolveNode: (attachment) => attachment.media,
});
// #endregion attachment-helper

// #region attachments-connection
builder.drizzleObjectField('posts', 'attachments', (t) =>
  t.connection(
    {
      type: Media,
      args: attachments.getArgs(),
      select: (args, ctx, nestedSelection) => {
        return {
          with: {
            attachments: attachments.getQuery(args, ctx, nestedSelection),
          },
        };
      },
      resolve: (post, args, ctx) => {
        return attachments.resolve(post.attachments, args, ctx);
      },
    },
    {},
    {
      fields: (edge) => ({
        caption: edge.string({
          nullable: true,
          resolve: (attachment) => attachment.caption,
        }),
      }),
    },
  ),
);
// #endregion attachments-connection
