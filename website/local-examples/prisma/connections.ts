import { prismaConnectionHelpers } from '@pothos/plugin-prisma';
import type { createSchemaBuilder } from './builder';

export function createMediaType(builder: ReturnType<typeof createSchemaBuilder>) {
  return builder.prismaObject('Media', {
    select: { id: true },
    fields: (t) => ({ url: t.exposeString('url'), uploadedBy: t.relation('uploadedBy') }),
  });
}

export function addMediaConnection(
  builder: ReturnType<typeof createSchemaBuilder>,
  Media: ReturnType<typeof createMediaType>,
) {
  // #region media-helper
  const mediaConnectionHelpers = prismaConnectionHelpers(builder, 'PostMedia', {
    cursor: 'id',
    query: { orderBy: { id: 'asc' } },
    select: (nodeSelection) => ({
      caption: true,
      media: nodeSelection({ select: { id: true } }),
    }),
    resolveNode: (attachment) => attachment.media,
  });
  // #endregion media-helper

  // #region media-connection
  builder.prismaObjectField('Post', 'mediaConnection', (t) =>
    t.connection(
      {
        type: Media,
        select: (args, ctx, nestedSelection) => ({
          _count: { select: { media: true } },
          media: mediaConnectionHelpers.getQuery(args, ctx, nestedSelection),
        }),
        resolve: (post, args, ctx) => {
          return {
            ...mediaConnectionHelpers.resolve(post.media, args, ctx),
            totalCount: post._count.media,
          };
        },
      },
      {
        fields: (connection) => ({
          totalCount: connection.int({ resolve: (result) => result.totalCount }),
        }),
      },
      {
        // #region media-edge
        fields: (edge) => ({
          caption: edge.string({ resolve: (attachment) => attachment.caption }),
        }),
        // #endregion media-edge
      },
    ),
  );
  // #endregion media-connection
}
