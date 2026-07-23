import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin, { type FieldSet } from '../../../src';

const builder = new SchemaBuilder({
  plugins: [DirectivesPlugin, FederationPlugin],
  directives: {
    useGraphQLToolsUnorderedDirectives: true,
  },
});

interface Image {
  __typename: 'Image';
  url: string;
}

interface Video {
  __typename: 'Video';
  url: string;
  previewUrl: string;
}

type Media = Image | Video;

const ImageRef = builder.objectRef<Image>('Image').implement({
  fields: (t) => ({
    url: t.exposeString('url'),
  }),
});

const VideoRef = builder.objectRef<Video>('Video').implement({
  fields: (t) => ({
    url: t.exposeString('url'),
    previewUrl: t.exposeString('previewUrl'),
  }),
});

const MediaUnion = builder.unionType('Media', {
  types: [ImageRef, VideoRef],
  resolveType: (media) => media.__typename,
});

const PostRef = builder.externalRef(
  'Post',
  builder.selection<{ id: string }>('id'),
  (entity) => entity,
);

PostRef.implement({
  externalFields: (t) => ({
    media: t.field({ type: [MediaUnion] }),
  }),
  fields: (t) => ({
    id: t.exposeString('id'),
    mediaUrls: t.stringList({
      requires: builder.selection<{ media: Media[] }>(
        'media { ... on Image { url } ... on Video { url } }' as FieldSet<{ media: Media[] }>,
      ),
      resolve: (post) => post.media.map((media) => media.url),
    }),
  }),
});

export const schema = builder.toSubGraphSchema({});
