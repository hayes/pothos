import { InputObjectRef } from '@pothos/core';
import * as Prisma from '../../../client';
import { builder } from '../builder';

type Types = typeof builder extends PothosSchemaTypes.SchemaBuilder<infer T> ? T : never;

builder.enumType(Prisma.Category, {
  name: 'Category',
});
export const PostFilter: InputObjectRef<Types, Prisma.Prisma.PostWhereInput> = builder.prismaWhere(
  'Post',
  {
    name: 'PostFilter',
    fields: () => ({
      id: IntFilter,
      createdAt: DateTimeFilter,
      updatedAt: DateTimeFilter,
      title: StringFilter,
      content: StringFilter,
      published: BooleanFilter,
      author: UserFilter,
      comments: CommentListFilter,
      authorId: IntFilter,
      media: PostMediaListFilter,
      tags: StringListFilter,
      categories: CategoryListFilter,
      ratings: IntListFilter,
      views: IntFilter,
    }),
  },
);
export const IntFilter = builder.prismaFilter('Int', {
  name: 'IntFilter',
  ops: ['equals', 'in', 'notIn', 'not', 'is', 'isNot', 'lt', 'lte', 'gt', 'gte'],
});
export const DateTimeFilter = builder.prismaFilter('DateTime', {
  name: 'DateTimeFilter',
  ops: ['equals', 'in', 'notIn', 'not', 'is', 'isNot', 'lt', 'lte', 'gt', 'gte'],
});
export const StringFilter = builder.prismaFilter('String', {
  name: 'StringFilter',
  ops: [
    'equals',
    'in',
    'notIn',
    'not',
    'is',
    'isNot',
    'equals',
    'in',
    'notIn',
    'not',
    'is',
    'isNot',
    'contains',
    'startsWith',
    'endsWith',
    'mode',
    'lt',
    'lte',
    'gt',
    'gte',
  ],
});
export const BooleanFilter = builder.prismaFilter('Boolean', {
  name: 'BooleanFilter',
  ops: ['equals', 'in', 'notIn', 'not', 'is', 'isNot'],
});
export const UserFilter: InputObjectRef<Types, Prisma.Prisma.UserWhereInput> = builder.prismaWhere(
  'User',
  {
    name: 'UserFilter',
    fields: () => ({
      id: IntFilter,
      email: StringFilter,
      name: StringFilter,
      posts: PostListFilter,
      comments: CommentListFilter,
      profile: ProfileFilter,
      followers: FollowListFilter,
      following: FollowListFilter,
      Media: MediaListFilter,
    }),
  },
);
export const PostListFilter = builder.prismaListFilter(PostFilter, {
  name: 'PostListFilter',
  ops: ['every', 'some', 'none'],
});
export const CommentFilter: InputObjectRef<Types, Prisma.Prisma.CommentWhereInput> =
  builder.prismaWhere('Comment', {
    name: 'CommentFilter',
    fields: () => ({
      id: IntFilter,
      createdAt: DateTimeFilter,
      content: StringFilter,
      author: UserFilter,
      post: PostFilter,
      authorId: IntFilter,
      postId: IntFilter,
    }),
  });
export const CommentListFilter = builder.prismaListFilter(CommentFilter, {
  name: 'CommentListFilter',
  ops: ['every', 'some', 'none'],
});
export const ProfileFilter: InputObjectRef<Types, Prisma.Prisma.ProfileWhereInput> =
  builder.prismaWhere('Profile', {
    name: 'ProfileFilter',
    fields: () => ({
      id: IntFilter,
      bio: StringFilter,
      user: UserFilter,
      userId: IntFilter,
    }),
  });
export const FollowFilter: InputObjectRef<Types, Prisma.Prisma.FollowWhereInput> =
  builder.prismaWhere('Follow', {
    name: 'FollowFilter',
    fields: () => ({
      fromId: IntFilter,
      toId: IntFilter,
      from: UserFilter,
      to: UserFilter,
    }),
  });
export const FollowListFilter = builder.prismaListFilter(FollowFilter, {
  name: 'FollowListFilter',
  ops: ['every', 'some', 'none'],
});
export const MediaFilter: InputObjectRef<Types, Prisma.Prisma.MediaWhereInput> =
  builder.prismaWhere('Media', {
    name: 'MediaFilter',
    fields: () => ({
      id: IntFilter,
      url: StringFilter,
      posts: PostMediaListFilter,
      uploadedBy: UserFilter,
      uploadedById: IntFilter,
    }),
  });
export const PostMediaFilter: InputObjectRef<Types, Prisma.Prisma.PostMediaWhereInput> =
  builder.prismaWhere('PostMedia', {
    name: 'PostMediaFilter',
    fields: () => ({
      id: IntFilter,
      post: PostFilter,
      media: MediaFilter,
      postId: IntFilter,
      mediaId: IntFilter,
      order: IntFilter,
    }),
  });
export const PostMediaListFilter = builder.prismaListFilter(PostMediaFilter, {
  name: 'PostMediaListFilter',
  ops: ['every', 'some', 'none'],
});
export const MediaListFilter = builder.prismaListFilter(MediaFilter, {
  name: 'MediaListFilter',
  ops: ['every', 'some', 'none'],
});
export const StringListFilter = builder.prismaScalarListFilter('String', {
  name: 'StringListFilter',
  ops: ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
});
export const CategoryListFilter = builder.prismaScalarListFilter(Prisma.Category, {
  name: 'CategoryListFilter',
  ops: ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
});
export const IntListFilter = builder.prismaScalarListFilter('Int', {
  name: 'IntListFilter',
  ops: ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'],
});
export const PostUniqueFilter = builder.prismaWhereUnique('Post', {
  name: 'PostUniqueFilter',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
  }),
});
export const CommentOrderBy: InputObjectRef<Types, Prisma.Prisma.CommentOrderByWithRelationInput> =
  builder.prismaOrderBy('Comment', {
    name: 'CommentOrderBy',
    fields: () => ({
      id: true,
      createdAt: true,
      content: true,
      author: UserOrderBy,
      post: PostOrderBy,
      authorId: true,
      postId: true,
    }),
  });
export const ProfileOrderBy: InputObjectRef<Types, Prisma.Prisma.ProfileOrderByWithRelationInput> =
  builder.prismaOrderBy('Profile', {
    name: 'ProfileOrderBy',
    fields: () => ({
      id: true,
      bio: true,
      user: UserOrderBy,
      userId: true,
    }),
  });
export const FollowOrderBy: InputObjectRef<Types, Prisma.Prisma.FollowOrderByWithRelationInput> =
  builder.prismaOrderBy('Follow', {
    name: 'FollowOrderBy',
    fields: () => ({
      fromId: true,
      toId: true,
      from: UserOrderBy,
      to: UserOrderBy,
    }),
  });
export const PostMediaOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.PostMediaOrderByWithRelationInput
> = builder.prismaOrderBy('PostMedia', {
  name: 'PostMediaOrderBy',
  fields: () => ({
    id: true,
    post: PostOrderBy,
    media: MediaOrderBy,
    postId: true,
    mediaId: true,
    order: true,
  }),
});
export const MediaOrderBy: InputObjectRef<Types, Prisma.Prisma.MediaOrderByWithRelationInput> =
  builder.prismaOrderBy('Media', {
    name: 'MediaOrderBy',
    fields: () => ({
      id: true,
      url: true,
      posts: PostMediaOrderBy,
      uploadedBy: UserOrderBy,
      uploadedById: true,
    }),
  });
export const UserOrderBy: InputObjectRef<Types, Prisma.Prisma.UserOrderByWithRelationInput> =
  builder.prismaOrderBy('User', {
    name: 'UserOrderBy',
    fields: () => ({
      id: true,
      email: true,
      name: true,
      posts: PostOrderBy,
      comments: CommentOrderBy,
      profile: ProfileOrderBy,
      followers: FollowOrderBy,
      following: FollowOrderBy,
      Media: MediaOrderBy,
    }),
  });
export const PostOrderBy: InputObjectRef<Types, Prisma.Prisma.PostOrderByWithRelationInput> =
  builder.prismaOrderBy('Post', {
    name: 'PostOrderBy',
    fields: () => ({
      id: true,
      createdAt: true,
      updatedAt: true,
      title: true,
      content: true,
      published: true,
      author: UserOrderBy,
      comments: CommentOrderBy,
      authorId: true,
      media: PostMediaOrderBy,
      tags: true,
      categories: true,
      ratings: true,
      views: true,
    }),
  });
export const ProfileCreateWithoutUser: InputObjectRef<
  Types,
  Prisma.Prisma.ProfileCreateWithoutUserInput
> = builder.prismaCreate('Profile', {
  name: 'ProfileCreateWithoutUser',
  fields: () => ({
    id: 'Int',
    bio: 'String',
  }),
});
export const ProfileUniqueFilter = builder.prismaWhereUnique('Profile', {
  name: 'ProfileUniqueFilter',
  fields: () => ({
    id: 'Int',
    userId: 'Int',
  }),
});
export const UserCreateProfile = builder.prismaCreateRelation('User', 'profile', {
  fields: () => ({
    create: ProfileCreateWithoutUser,
    connect: ProfileUniqueFilter,
  }),
});
export const PostCreateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.PostCreateWithoutMediaInput
> = builder.prismaCreate('Post', {
  name: 'PostCreateWithoutMedia',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    author: PostCreateAuthor,
    comments: PostCreateComments,
    authorId: 'Int',
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const PostMediaCreatePost = builder.prismaCreateRelation('PostMedia', 'post', {
  fields: () => ({
    create: PostCreateWithoutMedia,
    connect: PostUniqueFilter,
  }),
});
export const PostMediaCreateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.PostMediaCreateWithoutMediaInput
> = builder.prismaCreate('PostMedia', {
  name: 'PostMediaCreateWithoutMedia',
  fields: () => ({
    id: 'Int',
    post: PostMediaCreatePost,
    postId: 'Int',
    order: 'Int',
  }),
});
export const PostMediaUniqueFilter = builder.prismaWhereUnique('PostMedia', {
  name: 'PostMediaUniqueFilter',
  fields: () => ({
    id: 'Int',
  }),
});
export const MediaCreatePosts = builder.prismaCreateRelation('Media', 'posts', {
  fields: () => ({
    create: PostMediaCreateWithoutMedia,
    connect: PostMediaUniqueFilter,
  }),
});
export const MediaCreateWithoutUploadedBy: InputObjectRef<
  Types,
  Prisma.Prisma.MediaCreateWithoutUploadedByInput
> = builder.prismaCreate('Media', {
  name: 'MediaCreateWithoutUploadedBy',
  fields: () => ({
    id: 'Int',
    url: 'String',
    posts: MediaCreatePosts,
  }),
});
export const MediaUniqueFilter = builder.prismaWhereUnique('Media', {
  name: 'MediaUniqueFilter',
  fields: () => ({
    id: 'Int',
  }),
});
export const UserCreateMedia = builder.prismaCreateRelation('User', 'Media', {
  fields: () => ({
    create: MediaCreateWithoutUploadedBy,
    connect: MediaUniqueFilter,
  }),
});
export const UserCreateWithoutFollowing: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutFollowingInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutFollowing',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserCreatePosts,
    comments: UserCreateComments,
    profile: UserCreateProfile,
    followers: UserCreateFollowers,
    Media: UserCreateMedia,
  }),
});
export const UserUniqueFilter = builder.prismaWhereUnique('User', {
  name: 'UserUniqueFilter',
  fields: () => ({
    id: 'Int',
    email: 'String',
  }),
});
export const FollowCreateFrom = builder.prismaCreateRelation('Follow', 'from', {
  fields: () => ({
    create: UserCreateWithoutFollowing,
    connect: UserUniqueFilter,
  }),
});
export const FollowCreateWithoutTo: InputObjectRef<
  Types,
  Prisma.Prisma.FollowCreateWithoutToInput
> = builder.prismaCreate('Follow', {
  name: 'FollowCreateWithoutTo',
  fields: () => ({
    fromId: 'Int',
    from: FollowCreateFrom,
  }),
});
export const FollowUniqueFilter = builder.prismaWhereUnique('Follow', {
  name: 'FollowUniqueFilter',
  fields: () => ({
    compositeID: 'Int',
  }),
});
export const UserCreateFollowers = builder.prismaCreateRelation('User', 'followers', {
  fields: () => ({
    create: FollowCreateWithoutTo,
    connect: FollowUniqueFilter,
  }),
});
export const UserCreateWithoutFollowers: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutFollowersInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutFollowers',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserCreatePosts,
    comments: UserCreateComments,
    profile: UserCreateProfile,
    following: UserCreateFollowing,
    Media: UserCreateMedia,
  }),
});
export const FollowCreateTo = builder.prismaCreateRelation('Follow', 'to', {
  fields: () => ({
    create: UserCreateWithoutFollowers,
    connect: UserUniqueFilter,
  }),
});
export const FollowCreateWithoutFrom: InputObjectRef<
  Types,
  Prisma.Prisma.FollowCreateWithoutFromInput
> = builder.prismaCreate('Follow', {
  name: 'FollowCreateWithoutFrom',
  fields: () => ({
    toId: 'Int',
    to: FollowCreateTo,
  }),
});
export const UserCreateFollowing = builder.prismaCreateRelation('User', 'following', {
  fields: () => ({
    create: FollowCreateWithoutFrom,
    connect: FollowUniqueFilter,
  }),
});
export const UserCreateWithoutComments: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutCommentsInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutComments',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserCreatePosts,
    profile: UserCreateProfile,
    followers: UserCreateFollowers,
    following: UserCreateFollowing,
    Media: UserCreateMedia,
  }),
});
export const CommentCreateAuthor = builder.prismaCreateRelation('Comment', 'author', {
  fields: () => ({
    create: UserCreateWithoutComments,
    connect: UserUniqueFilter,
  }),
});
export const CommentCreateWithoutPost: InputObjectRef<
  Types,
  Prisma.Prisma.CommentCreateWithoutPostInput
> = builder.prismaCreate('Comment', {
  name: 'CommentCreateWithoutPost',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    content: 'String',
    author: CommentCreateAuthor,
    authorId: 'Int',
  }),
});
export const CommentUniqueFilter = builder.prismaWhereUnique('Comment', {
  name: 'CommentUniqueFilter',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
  }),
});
export const PostCreateComments = builder.prismaCreateRelation('Post', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutPost,
    connect: CommentUniqueFilter,
  }),
});
export const PostCreateWithoutAuthor: InputObjectRef<
  Types,
  Prisma.Prisma.PostCreateWithoutAuthorInput
> = builder.prismaCreate('Post', {
  name: 'PostCreateWithoutAuthor',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    comments: PostCreateComments,
    media: PostCreateMedia,
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const UserCreatePosts = builder.prismaCreateRelation('User', 'posts', {
  fields: () => ({
    create: PostCreateWithoutAuthor,
    connect: PostUniqueFilter,
  }),
});
export const UserCreateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutMediaInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutMedia',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserCreatePosts,
    comments: UserCreateComments,
    profile: UserCreateProfile,
    followers: UserCreateFollowers,
    following: UserCreateFollowing,
  }),
});
export const MediaCreateUploadedBy = builder.prismaCreateRelation('Media', 'uploadedBy', {
  fields: () => ({
    create: UserCreateWithoutMedia,
    connect: UserUniqueFilter,
  }),
});
export const MediaCreateWithoutPosts: InputObjectRef<
  Types,
  Prisma.Prisma.MediaCreateWithoutPostsInput
> = builder.prismaCreate('Media', {
  name: 'MediaCreateWithoutPosts',
  fields: () => ({
    id: 'Int',
    url: 'String',
    uploadedBy: MediaCreateUploadedBy,
    uploadedById: 'Int',
  }),
});
export const PostMediaCreateMedia = builder.prismaCreateRelation('PostMedia', 'media', {
  fields: () => ({
    create: MediaCreateWithoutPosts,
    connect: MediaUniqueFilter,
  }),
});
export const PostMediaCreateWithoutPost: InputObjectRef<
  Types,
  Prisma.Prisma.PostMediaCreateWithoutPostInput
> = builder.prismaCreate('PostMedia', {
  name: 'PostMediaCreateWithoutPost',
  fields: () => ({
    id: 'Int',
    media: PostMediaCreateMedia,
    mediaId: 'Int',
    order: 'Int',
  }),
});
export const PostCreateMedia = builder.prismaCreateRelation('Post', 'media', {
  fields: () => ({
    create: PostMediaCreateWithoutPost,
    connect: PostMediaUniqueFilter,
  }),
});
export const PostCreateWithoutComments: InputObjectRef<
  Types,
  Prisma.Prisma.PostCreateWithoutCommentsInput
> = builder.prismaCreate('Post', {
  name: 'PostCreateWithoutComments',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    author: PostCreateAuthor,
    authorId: 'Int',
    media: PostCreateMedia,
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const CommentCreatePost = builder.prismaCreateRelation('Comment', 'post', {
  fields: () => ({
    create: PostCreateWithoutComments,
    connect: PostUniqueFilter,
  }),
});
export const CommentCreateWithoutAuthor: InputObjectRef<
  Types,
  Prisma.Prisma.CommentCreateWithoutAuthorInput
> = builder.prismaCreate('Comment', {
  name: 'CommentCreateWithoutAuthor',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    content: 'String',
    post: CommentCreatePost,
    postId: 'Int',
  }),
});
export const UserCreateComments = builder.prismaCreateRelation('User', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutAuthor,
    connect: CommentUniqueFilter,
  }),
});
export const UserCreateWithoutPosts: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutPostsInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutPosts',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    comments: UserCreateComments,
    profile: UserCreateProfile,
    followers: UserCreateFollowers,
    following: UserCreateFollowing,
    Media: UserCreateMedia,
  }),
});
export const PostCreateAuthor = builder.prismaCreateRelation('Post', 'author', {
  fields: () => ({
    create: UserCreateWithoutPosts,
    connect: UserUniqueFilter,
  }),
});
export const PostCreate: InputObjectRef<Types, Prisma.Prisma.PostCreateInput> =
  builder.prismaCreate('Post', {
    name: 'PostCreate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostCreateAuthor,
      comments: PostCreateComments,
      authorId: 'Int',
      media: PostCreateMedia,
      tags: 'String',
      categories: Prisma.Category,
      ratings: 'Int',
      views: 'Int',
    }),
  });
export const ProfileUpdateWithoutUser: InputObjectRef<
  Types,
  Prisma.Prisma.ProfileUpdateWithoutUserInput
> = builder.prismaUpdate('Profile', {
  name: 'ProfileUpdateWithoutUser',
  fields: () => ({
    id: 'Int',
    bio: 'String',
  }),
});
export const UserUpdateProfile = builder.prismaUpdateRelation('User', 'profile', {
  fields: () => ({
    create: ProfileCreateWithoutUser,
    update: ProfileUpdateWithoutUser,
    connect: ProfileUniqueFilter,
    disconnect: true,
    delete: true,
  }),
});
export const PostUpdateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.PostUpdateWithoutMediaInput
> = builder.prismaUpdate('Post', {
  name: 'PostUpdateWithoutMedia',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    author: PostUpdateAuthor,
    comments: PostUpdateComments,
    authorId: 'Int',
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const PostMediaUpdatePost = builder.prismaUpdateRelation('PostMedia', 'post', {
  fields: () => ({
    create: PostCreateWithoutMedia,
    update: PostUpdateWithoutMedia,
    connect: PostUniqueFilter,
  }),
});
export const PostMediaUpdateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.PostMediaUpdateWithoutMediaInput
> = builder.prismaUpdate('PostMedia', {
  name: 'PostMediaUpdateWithoutMedia',
  fields: () => ({
    id: 'Int',
    post: PostMediaUpdatePost,
    postId: 'Int',
    order: 'Int',
  }),
});
export const PostMediaWithoutMediaFilter: InputObjectRef<Types, Prisma.Prisma.PostMediaWhereInput> =
  builder.prismaWhere('PostMedia', {
    name: 'PostMediaWithoutMediaFilter',
    fields: () => ({
      id: IntFilter,
      post: PostFilter,
      postId: IntFilter,
      order: IntFilter,
    }),
  });
export const MediaUpdatePosts = builder.prismaUpdateRelation('Media', 'posts', {
  fields: () => ({
    create: PostMediaCreateWithoutMedia,
    set: PostMediaUniqueFilter,
    disconnect: PostMediaUniqueFilter,
    delete: PostMediaUniqueFilter,
    connect: PostMediaUniqueFilter,
    update: {
      where: PostMediaUniqueFilter,
      data: PostMediaUpdateWithoutMedia,
    },
    updateMany: {
      where: PostMediaWithoutMediaFilter,
      data: PostMediaUpdateWithoutMedia,
    },
    deleteMany: PostMediaWithoutMediaFilter,
  }),
});
export const MediaUpdateWithoutUploadedBy: InputObjectRef<
  Types,
  Prisma.Prisma.MediaUpdateWithoutUploadedByInput
> = builder.prismaUpdate('Media', {
  name: 'MediaUpdateWithoutUploadedBy',
  fields: () => ({
    id: 'Int',
    url: 'String',
    posts: MediaUpdatePosts,
  }),
});
export const MediaWithoutUploadedByFilter: InputObjectRef<Types, Prisma.Prisma.MediaWhereInput> =
  builder.prismaWhere('Media', {
    name: 'MediaWithoutUploadedByFilter',
    fields: () => ({
      id: IntFilter,
      url: StringFilter,
      posts: PostMediaListFilter,
    }),
  });
export const UserUpdateMedia = builder.prismaUpdateRelation('User', 'Media', {
  fields: () => ({
    create: MediaCreateWithoutUploadedBy,
    set: MediaUniqueFilter,
    disconnect: MediaUniqueFilter,
    delete: MediaUniqueFilter,
    connect: MediaUniqueFilter,
    update: {
      where: MediaUniqueFilter,
      data: MediaUpdateWithoutUploadedBy,
    },
    updateMany: {
      where: MediaWithoutUploadedByFilter,
      data: MediaUpdateWithoutUploadedBy,
    },
    deleteMany: MediaWithoutUploadedByFilter,
  }),
});
export const UserUpdateWithoutFollowing: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutFollowingInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutFollowing',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserUpdatePosts,
    comments: UserUpdateComments,
    profile: UserUpdateProfile,
    followers: UserUpdateFollowers,
    Media: UserUpdateMedia,
  }),
});
export const FollowUpdateFrom = builder.prismaUpdateRelation('Follow', 'from', {
  fields: () => ({
    create: UserCreateWithoutFollowing,
    update: UserUpdateWithoutFollowing,
    connect: UserUniqueFilter,
  }),
});
export const FollowUpdateWithoutTo: InputObjectRef<
  Types,
  Prisma.Prisma.FollowUpdateWithoutToInput
> = builder.prismaUpdate('Follow', {
  name: 'FollowUpdateWithoutTo',
  fields: () => ({
    fromId: 'Int',
    from: FollowUpdateFrom,
  }),
});
export const FollowWithoutToFilter: InputObjectRef<Types, Prisma.Prisma.FollowWhereInput> =
  builder.prismaWhere('Follow', {
    name: 'FollowWithoutToFilter',
    fields: () => ({
      fromId: IntFilter,
      from: UserFilter,
    }),
  });
export const UserUpdateFollowers = builder.prismaUpdateRelation('User', 'followers', {
  fields: () => ({
    create: FollowCreateWithoutTo,
    set: FollowUniqueFilter,
    disconnect: FollowUniqueFilter,
    delete: FollowUniqueFilter,
    connect: FollowUniqueFilter,
    update: {
      where: FollowUniqueFilter,
      data: FollowUpdateWithoutTo,
    },
    updateMany: {
      where: FollowWithoutToFilter,
      data: FollowUpdateWithoutTo,
    },
    deleteMany: FollowWithoutToFilter,
  }),
});
export const UserUpdateWithoutFollowers: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutFollowersInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutFollowers',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserUpdatePosts,
    comments: UserUpdateComments,
    profile: UserUpdateProfile,
    following: UserUpdateFollowing,
    Media: UserUpdateMedia,
  }),
});
export const FollowUpdateTo = builder.prismaUpdateRelation('Follow', 'to', {
  fields: () => ({
    create: UserCreateWithoutFollowers,
    update: UserUpdateWithoutFollowers,
    connect: UserUniqueFilter,
  }),
});
export const FollowUpdateWithoutFrom: InputObjectRef<
  Types,
  Prisma.Prisma.FollowUpdateWithoutFromInput
> = builder.prismaUpdate('Follow', {
  name: 'FollowUpdateWithoutFrom',
  fields: () => ({
    toId: 'Int',
    to: FollowUpdateTo,
  }),
});
export const FollowWithoutFromFilter: InputObjectRef<Types, Prisma.Prisma.FollowWhereInput> =
  builder.prismaWhere('Follow', {
    name: 'FollowWithoutFromFilter',
    fields: () => ({
      toId: IntFilter,
      to: UserFilter,
    }),
  });
export const UserUpdateFollowing = builder.prismaUpdateRelation('User', 'following', {
  fields: () => ({
    create: FollowCreateWithoutFrom,
    set: FollowUniqueFilter,
    disconnect: FollowUniqueFilter,
    delete: FollowUniqueFilter,
    connect: FollowUniqueFilter,
    update: {
      where: FollowUniqueFilter,
      data: FollowUpdateWithoutFrom,
    },
    updateMany: {
      where: FollowWithoutFromFilter,
      data: FollowUpdateWithoutFrom,
    },
    deleteMany: FollowWithoutFromFilter,
  }),
});
export const UserUpdateWithoutComments: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutCommentsInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutComments',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserUpdatePosts,
    profile: UserUpdateProfile,
    followers: UserUpdateFollowers,
    following: UserUpdateFollowing,
    Media: UserUpdateMedia,
  }),
});
export const CommentUpdateAuthor = builder.prismaUpdateRelation('Comment', 'author', {
  fields: () => ({
    create: UserCreateWithoutComments,
    update: UserUpdateWithoutComments,
    connect: UserUniqueFilter,
  }),
});
export const CommentUpdateWithoutPost: InputObjectRef<
  Types,
  Prisma.Prisma.CommentUpdateWithoutPostInput
> = builder.prismaUpdate('Comment', {
  name: 'CommentUpdateWithoutPost',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    content: 'String',
    author: CommentUpdateAuthor,
    authorId: 'Int',
  }),
});
export const CommentWithoutPostFilter: InputObjectRef<Types, Prisma.Prisma.CommentWhereInput> =
  builder.prismaWhere('Comment', {
    name: 'CommentWithoutPostFilter',
    fields: () => ({
      id: IntFilter,
      createdAt: DateTimeFilter,
      content: StringFilter,
      author: UserFilter,
      authorId: IntFilter,
    }),
  });
export const PostUpdateComments = builder.prismaUpdateRelation('Post', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutPost,
    set: CommentUniqueFilter,
    disconnect: CommentUniqueFilter,
    delete: CommentUniqueFilter,
    connect: CommentUniqueFilter,
    update: {
      where: CommentUniqueFilter,
      data: CommentUpdateWithoutPost,
    },
    updateMany: {
      where: CommentWithoutPostFilter,
      data: CommentUpdateWithoutPost,
    },
    deleteMany: CommentWithoutPostFilter,
  }),
});
export const PostUpdateWithoutAuthor: InputObjectRef<
  Types,
  Prisma.Prisma.PostUpdateWithoutAuthorInput
> = builder.prismaUpdate('Post', {
  name: 'PostUpdateWithoutAuthor',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    comments: PostUpdateComments,
    media: PostUpdateMedia,
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const PostWithoutAuthorFilter: InputObjectRef<Types, Prisma.Prisma.PostWhereInput> =
  builder.prismaWhere('Post', {
    name: 'PostWithoutAuthorFilter',
    fields: () => ({
      id: IntFilter,
      createdAt: DateTimeFilter,
      updatedAt: DateTimeFilter,
      title: StringFilter,
      content: StringFilter,
      published: BooleanFilter,
      comments: CommentListFilter,
      media: PostMediaListFilter,
      tags: StringListFilter,
      categories: CategoryListFilter,
      ratings: IntListFilter,
      views: IntFilter,
    }),
  });
export const UserUpdatePosts = builder.prismaUpdateRelation('User', 'posts', {
  fields: () => ({
    create: PostCreateWithoutAuthor,
    set: PostUniqueFilter,
    disconnect: PostUniqueFilter,
    delete: PostUniqueFilter,
    connect: PostUniqueFilter,
    update: {
      where: PostUniqueFilter,
      data: PostUpdateWithoutAuthor,
    },
    updateMany: {
      where: PostWithoutAuthorFilter,
      data: PostUpdateWithoutAuthor,
    },
    deleteMany: PostWithoutAuthorFilter,
  }),
});
export const UserUpdateWithoutMedia: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutMediaInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutMedia',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserUpdatePosts,
    comments: UserUpdateComments,
    profile: UserUpdateProfile,
    followers: UserUpdateFollowers,
    following: UserUpdateFollowing,
  }),
});
export const MediaUpdateUploadedBy = builder.prismaUpdateRelation('Media', 'uploadedBy', {
  fields: () => ({
    create: UserCreateWithoutMedia,
    update: UserUpdateWithoutMedia,
    connect: UserUniqueFilter,
  }),
});
export const MediaUpdateWithoutPosts: InputObjectRef<
  Types,
  Prisma.Prisma.MediaUpdateWithoutPostsInput
> = builder.prismaUpdate('Media', {
  name: 'MediaUpdateWithoutPosts',
  fields: () => ({
    id: 'Int',
    url: 'String',
    uploadedBy: MediaUpdateUploadedBy,
    uploadedById: 'Int',
  }),
});
export const PostMediaUpdateMedia = builder.prismaUpdateRelation('PostMedia', 'media', {
  fields: () => ({
    create: MediaCreateWithoutPosts,
    update: MediaUpdateWithoutPosts,
    connect: MediaUniqueFilter,
  }),
});
export const PostMediaUpdateWithoutPost: InputObjectRef<
  Types,
  Prisma.Prisma.PostMediaUpdateWithoutPostInput
> = builder.prismaUpdate('PostMedia', {
  name: 'PostMediaUpdateWithoutPost',
  fields: () => ({
    id: 'Int',
    media: PostMediaUpdateMedia,
    mediaId: 'Int',
    order: 'Int',
  }),
});
export const PostMediaWithoutPostFilter: InputObjectRef<Types, Prisma.Prisma.PostMediaWhereInput> =
  builder.prismaWhere('PostMedia', {
    name: 'PostMediaWithoutPostFilter',
    fields: () => ({
      id: IntFilter,
      media: MediaFilter,
      mediaId: IntFilter,
      order: IntFilter,
    }),
  });
export const PostUpdateMedia = builder.prismaUpdateRelation('Post', 'media', {
  fields: () => ({
    create: PostMediaCreateWithoutPost,
    set: PostMediaUniqueFilter,
    disconnect: PostMediaUniqueFilter,
    delete: PostMediaUniqueFilter,
    connect: PostMediaUniqueFilter,
    update: {
      where: PostMediaUniqueFilter,
      data: PostMediaUpdateWithoutPost,
    },
    updateMany: {
      where: PostMediaWithoutPostFilter,
      data: PostMediaUpdateWithoutPost,
    },
    deleteMany: PostMediaWithoutPostFilter,
  }),
});
export const PostUpdateWithoutComments: InputObjectRef<
  Types,
  Prisma.Prisma.PostUpdateWithoutCommentsInput
> = builder.prismaUpdate('Post', {
  name: 'PostUpdateWithoutComments',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    updatedAt: 'DateTime',
    title: 'String',
    content: 'String',
    published: 'Boolean',
    author: PostUpdateAuthor,
    authorId: 'Int',
    media: PostUpdateMedia,
    tags: 'String',
    categories: Prisma.Category,
    ratings: 'Int',
    views: 'Int',
  }),
});
export const CommentUpdatePost = builder.prismaUpdateRelation('Comment', 'post', {
  fields: () => ({
    create: PostCreateWithoutComments,
    update: PostUpdateWithoutComments,
    connect: PostUniqueFilter,
  }),
});
export const CommentUpdateWithoutAuthor: InputObjectRef<
  Types,
  Prisma.Prisma.CommentUpdateWithoutAuthorInput
> = builder.prismaUpdate('Comment', {
  name: 'CommentUpdateWithoutAuthor',
  fields: () => ({
    id: 'Int',
    createdAt: 'DateTime',
    content: 'String',
    post: CommentUpdatePost,
    postId: 'Int',
  }),
});
export const CommentWithoutAuthorFilter: InputObjectRef<Types, Prisma.Prisma.CommentWhereInput> =
  builder.prismaWhere('Comment', {
    name: 'CommentWithoutAuthorFilter',
    fields: () => ({
      id: IntFilter,
      createdAt: DateTimeFilter,
      content: StringFilter,
      post: PostFilter,
      postId: IntFilter,
    }),
  });
export const UserUpdateComments = builder.prismaUpdateRelation('User', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutAuthor,
    set: CommentUniqueFilter,
    disconnect: CommentUniqueFilter,
    delete: CommentUniqueFilter,
    connect: CommentUniqueFilter,
    update: {
      where: CommentUniqueFilter,
      data: CommentUpdateWithoutAuthor,
    },
    updateMany: {
      where: CommentWithoutAuthorFilter,
      data: CommentUpdateWithoutAuthor,
    },
    deleteMany: CommentWithoutAuthorFilter,
  }),
});
export const UserUpdateWithoutPosts: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutPostsInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutPosts',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    comments: UserUpdateComments,
    profile: UserUpdateProfile,
    followers: UserUpdateFollowers,
    following: UserUpdateFollowing,
    Media: UserUpdateMedia,
  }),
});
export const PostUpdateAuthor = builder.prismaUpdateRelation('Post', 'author', {
  fields: () => ({
    create: UserCreateWithoutPosts,
    update: UserUpdateWithoutPosts,
    connect: UserUniqueFilter,
  }),
});
export const PostUpdate: InputObjectRef<Types, Prisma.Prisma.PostUpdateInput> =
  builder.prismaUpdate('Post', {
    name: 'PostUpdate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostUpdateAuthor,
      comments: PostUpdateComments,
      authorId: 'Int',
      media: PostUpdateMedia,
      tags: 'String',
      categories: Prisma.Category,
      ratings: 'Int',
      views: 'Int',
    }),
  });
export const MediaCreate: InputObjectRef<Types, Prisma.Prisma.MediaCreateInput> =
  builder.prismaCreate('Media', {
    name: 'MediaCreate',
    fields: () => ({
      id: 'Int',
      url: 'String',
      posts: MediaCreatePosts,
      uploadedBy: MediaCreateUploadedBy,
      uploadedById: 'Int',
    }),
  });
export const MediaUpdate: InputObjectRef<Types, Prisma.Prisma.MediaUpdateInput> =
  builder.prismaUpdate('Media', {
    name: 'MediaUpdate',
    fields: () => ({
      id: 'Int',
      url: 'String',
      posts: MediaUpdatePosts,
      uploadedBy: MediaUpdateUploadedBy,
      uploadedById: 'Int',
    }),
  });
export const PostMediaCreate: InputObjectRef<Types, Prisma.Prisma.PostMediaCreateInput> =
  builder.prismaCreate('PostMedia', {
    name: 'PostMediaCreate',
    fields: () => ({
      id: 'Int',
      post: PostMediaCreatePost,
      media: PostMediaCreateMedia,
      postId: 'Int',
      mediaId: 'Int',
      order: 'Int',
    }),
  });
export const PostMediaUpdate: InputObjectRef<Types, Prisma.Prisma.PostMediaUpdateInput> =
  builder.prismaUpdate('PostMedia', {
    name: 'PostMediaUpdate',
    fields: () => ({
      id: 'Int',
      post: PostMediaUpdatePost,
      media: PostMediaUpdateMedia,
      postId: 'Int',
      mediaId: 'Int',
      order: 'Int',
    }),
  });
export const CommentCreate: InputObjectRef<Types, Prisma.Prisma.CommentCreateInput> =
  builder.prismaCreate('Comment', {
    name: 'CommentCreate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      author: CommentCreateAuthor,
      post: CommentCreatePost,
      authorId: 'Int',
      postId: 'Int',
    }),
  });
export const CommentUpdate: InputObjectRef<Types, Prisma.Prisma.CommentUpdateInput> =
  builder.prismaUpdate('Comment', {
    name: 'CommentUpdate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      author: CommentUpdateAuthor,
      post: CommentUpdatePost,
      authorId: 'Int',
      postId: 'Int',
    }),
  });
export const UserCreateWithoutProfile: InputObjectRef<
  Types,
  Prisma.Prisma.UserCreateWithoutProfileInput
> = builder.prismaCreate('User', {
  name: 'UserCreateWithoutProfile',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserCreatePosts,
    comments: UserCreateComments,
    followers: UserCreateFollowers,
    following: UserCreateFollowing,
    Media: UserCreateMedia,
  }),
});
export const ProfileCreateUser = builder.prismaCreateRelation('Profile', 'user', {
  fields: () => ({
    create: UserCreateWithoutProfile,
    connect: UserUniqueFilter,
  }),
});
export const ProfileCreate: InputObjectRef<Types, Prisma.Prisma.ProfileCreateInput> =
  builder.prismaCreate('Profile', {
    name: 'ProfileCreate',
    fields: () => ({
      id: 'Int',
      bio: 'String',
      user: ProfileCreateUser,
      userId: 'Int',
    }),
  });
export const UserUpdateWithoutProfile: InputObjectRef<
  Types,
  Prisma.Prisma.UserUpdateWithoutProfileInput
> = builder.prismaUpdate('User', {
  name: 'UserUpdateWithoutProfile',
  fields: () => ({
    id: 'Int',
    email: 'String',
    name: 'String',
    posts: UserUpdatePosts,
    comments: UserUpdateComments,
    followers: UserUpdateFollowers,
    following: UserUpdateFollowing,
    Media: UserUpdateMedia,
  }),
});
export const ProfileUpdateUser = builder.prismaUpdateRelation('Profile', 'user', {
  fields: () => ({
    create: UserCreateWithoutProfile,
    update: UserUpdateWithoutProfile,
    connect: UserUniqueFilter,
    disconnect: true,
    delete: true,
  }),
});
export const ProfileUpdate: InputObjectRef<Types, Prisma.Prisma.ProfileUpdateInput> =
  builder.prismaUpdate('Profile', {
    name: 'ProfileUpdate',
    fields: () => ({
      id: 'Int',
      bio: 'String',
      user: ProfileUpdateUser,
      userId: 'Int',
    }),
  });
export const UserCreate: InputObjectRef<Types, Prisma.Prisma.UserCreateInput> =
  builder.prismaCreate('User', {
    name: 'UserCreate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserCreatePosts,
      comments: UserCreateComments,
      profile: UserCreateProfile,
      followers: UserCreateFollowers,
      following: UserCreateFollowing,
      Media: UserCreateMedia,
    }),
  });
export const UserUpdate: InputObjectRef<Types, Prisma.Prisma.UserUpdateInput> =
  builder.prismaUpdate('User', {
    name: 'UserUpdate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserUpdatePosts,
      comments: UserUpdateComments,
      profile: UserUpdateProfile,
      followers: UserUpdateFollowers,
      following: UserUpdateFollowing,
      Media: UserUpdateMedia,
    }),
  });
export const FollowCreate: InputObjectRef<Types, Prisma.Prisma.FollowCreateInput> =
  builder.prismaCreate('Follow', {
    name: 'FollowCreate',
    fields: () => ({
      fromId: 'Int',
      toId: 'Int',
      from: FollowCreateFrom,
      to: FollowCreateTo,
    }),
  });
export const FollowUpdate: InputObjectRef<Types, Prisma.Prisma.FollowUpdateInput> =
  builder.prismaUpdate('Follow', {
    name: 'FollowUpdate',
    fields: () => ({
      fromId: 'Int',
      toId: 'Int',
      from: FollowUpdateFrom,
      to: FollowUpdateTo,
    }),
  });
export const UnrelatedFilter: InputObjectRef<Types, Prisma.Prisma.UnrelatedWhereInput> =
  builder.prismaWhere('Unrelated', {
    name: 'UnrelatedFilter',
    fields: () => ({
      id: IntFilter,
      name: StringFilter,
    }),
  });
export const UnrelatedUniqueFilter = builder.prismaWhereUnique('Unrelated', {
  name: 'UnrelatedUniqueFilter',
  fields: () => ({
    id: 'Int',
  }),
});
export const UnrelatedOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.UnrelatedOrderByWithRelationInput
> = builder.prismaOrderBy('Unrelated', {
  name: 'UnrelatedOrderBy',
  fields: () => ({
    id: true,
    name: true,
  }),
});
export const UnrelatedCreate: InputObjectRef<Types, Prisma.Prisma.UnrelatedCreateInput> =
  builder.prismaCreate('Unrelated', {
    name: 'UnrelatedCreate',
    fields: () => ({
      id: 'Int',
      name: 'String',
    }),
  });
export const UnrelatedUpdate: InputObjectRef<Types, Prisma.Prisma.UnrelatedUpdateInput> =
  builder.prismaUpdate('Unrelated', {
    name: 'UnrelatedUpdate',
    fields: () => ({
      id: 'Int',
      name: 'String',
    }),
  });
export const WithIDFilter: InputObjectRef<Types, Prisma.Prisma.WithIDWhereInput> =
  builder.prismaWhere('WithID', {
    name: 'WithIDFilter',
    fields: () => ({
      id: StringFilter,
      FindUniqueRelations: FindUniqueRelationsListFilter,
    }),
  });
export const FindUniqueRelationsFilter: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsWhereInput
> = builder.prismaWhere('FindUniqueRelations', {
  name: 'FindUniqueRelationsFilter',
  fields: () => ({
    id: StringFilter,
    withID_id: StringFilter,
    withID: WithIDFilter,
    withUnique_id: StringFilter,
    withUnique: WithUniqueFilter,
    withCompositeID_a: StringFilter,
    withCompositeID_b: StringFilter,
    withCompositeID: WithCompositeIDFilter,
    withCompositeUnique_a: StringFilter,
    withCompositeUnique_b: StringFilter,
    withCompositeUnique: WithCompositeUniqueFilter,
  }),
});
export const WithUniqueFilter: InputObjectRef<Types, Prisma.Prisma.WithUniqueWhereInput> =
  builder.prismaWhere('WithUnique', {
    name: 'WithUniqueFilter',
    fields: () => ({
      id: StringFilter,
      FindUniqueRelations: FindUniqueRelationsListFilter,
    }),
  });
export const FindUniqueRelationsListFilter = builder.prismaListFilter(FindUniqueRelationsFilter, {
  name: 'FindUniqueRelationsListFilter',
  ops: ['every', 'some', 'none'],
});
export const WithCompositeIDFilter: InputObjectRef<Types, Prisma.Prisma.WithCompositeIDWhereInput> =
  builder.prismaWhere('WithCompositeID', {
    name: 'WithCompositeIDFilter',
    fields: () => ({
      a: StringFilter,
      b: StringFilter,
      FindUniqueRelations: FindUniqueRelationsListFilter,
    }),
  });
export const WithCompositeUniqueFilter: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueWhereInput
> = builder.prismaWhere('WithCompositeUnique', {
  name: 'WithCompositeUniqueFilter',
  fields: () => ({
    a: StringFilter,
    c: StringFilter,
    b: StringFilter,
    FindUniqueRelations: FindUniqueRelationsListFilter,
  }),
});
export const WithIDUniqueFilter = builder.prismaWhereUnique('WithID', {
  name: 'WithIDUniqueFilter',
  fields: () => ({
    id: 'String',
  }),
});
export const WithUniqueOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.WithUniqueOrderByWithRelationInput
> = builder.prismaOrderBy('WithUnique', {
  name: 'WithUniqueOrderBy',
  fields: () => ({
    id: true,
    FindUniqueRelations: FindUniqueRelationsOrderBy,
  }),
});
export const WithCompositeIDOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeIDOrderByWithRelationInput
> = builder.prismaOrderBy('WithCompositeID', {
  name: 'WithCompositeIDOrderBy',
  fields: () => ({
    a: true,
    b: true,
    FindUniqueRelations: FindUniqueRelationsOrderBy,
  }),
});
export const WithCompositeUniqueOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueOrderByWithRelationInput
> = builder.prismaOrderBy('WithCompositeUnique', {
  name: 'WithCompositeUniqueOrderBy',
  fields: () => ({
    a: true,
    c: true,
    b: true,
    FindUniqueRelations: FindUniqueRelationsOrderBy,
  }),
});
export const FindUniqueRelationsOrderBy: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsOrderByWithRelationInput
> = builder.prismaOrderBy('FindUniqueRelations', {
  name: 'FindUniqueRelationsOrderBy',
  fields: () => ({
    id: true,
    withID_id: true,
    withID: WithIDOrderBy,
    withUnique_id: true,
    withUnique: WithUniqueOrderBy,
    withCompositeID_a: true,
    withCompositeID_b: true,
    withCompositeID: WithCompositeIDOrderBy,
    withCompositeUnique_a: true,
    withCompositeUnique_b: true,
    withCompositeUnique: WithCompositeUniqueOrderBy,
  }),
});
export const WithIDOrderBy: InputObjectRef<Types, Prisma.Prisma.WithIDOrderByWithRelationInput> =
  builder.prismaOrderBy('WithID', {
    name: 'WithIDOrderBy',
    fields: () => ({
      id: true,
      FindUniqueRelations: FindUniqueRelationsOrderBy,
    }),
  });
export const WithUniqueCreateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithUniqueCreateWithoutFindUniqueRelationsInput
> = builder.prismaCreate('WithUnique', {
  name: 'WithUniqueCreateWithoutFindUniqueRelations',
  fields: () => ({
    id: 'String',
  }),
});
export const WithUniqueUniqueFilter = builder.prismaWhereUnique('WithUnique', {
  name: 'WithUniqueUniqueFilter',
  fields: () => ({
    id: 'String',
  }),
});
export const FindUniqueRelationsCreateWithUnique = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withUnique',
  {
    fields: () => ({
      create: WithUniqueCreateWithoutFindUniqueRelations,
      connect: WithUniqueUniqueFilter,
    }),
  },
);
export const WithCompositeIDCreateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeIDCreateWithoutFindUniqueRelationsInput
> = builder.prismaCreate('WithCompositeID', {
  name: 'WithCompositeIDCreateWithoutFindUniqueRelations',
  fields: () => ({
    a: 'String',
    b: 'String',
  }),
});
export const WithCompositeIDUniqueFilter = builder.prismaWhereUnique('WithCompositeID', {
  name: 'WithCompositeIDUniqueFilter',
  fields: () => ({
    a_b: 'String',
  }),
});
export const FindUniqueRelationsCreateWithCompositeID = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withCompositeID',
  {
    fields: () => ({
      create: WithCompositeIDCreateWithoutFindUniqueRelations,
      connect: WithCompositeIDUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueCreateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueCreateWithoutFindUniqueRelationsInput
> = builder.prismaCreate('WithCompositeUnique', {
  name: 'WithCompositeUniqueCreateWithoutFindUniqueRelations',
  fields: () => ({
    a: 'String',
    c: 'String',
    b: 'String',
  }),
});
export const WithCompositeUniqueUniqueFilter = builder.prismaWhereUnique('WithCompositeUnique', {
  name: 'WithCompositeUniqueUniqueFilter',
  fields: () => ({
    c: 'String',
    a_c: 'String',
    a_b: 'String',
  }),
});
export const FindUniqueRelationsCreateWithCompositeUnique = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withCompositeUnique',
  {
    fields: () => ({
      create: WithCompositeUniqueCreateWithoutFindUniqueRelations,
      connect: WithCompositeUniqueUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsCreateWithoutWithID: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsCreateWithoutWithIDInput
> = builder.prismaCreate('FindUniqueRelations', {
  name: 'FindUniqueRelationsCreateWithoutWithID',
  fields: () => ({
    id: 'String',
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsCreateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsCreateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsCreateWithCompositeUnique,
  }),
});
export const FindUniqueRelationsUniqueFilter = builder.prismaWhereUnique('FindUniqueRelations', {
  name: 'FindUniqueRelationsUniqueFilter',
  fields: () => ({
    id: 'String',
  }),
});
export const WithIDCreateFindUniqueRelations = builder.prismaCreateRelation(
  'WithID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithID,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithIDCreate: InputObjectRef<Types, Prisma.Prisma.WithIDCreateInput> =
  builder.prismaCreate('WithID', {
    name: 'WithIDCreate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithIDCreateFindUniqueRelations,
    }),
  });
export const WithUniqueUpdateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithUniqueUpdateWithoutFindUniqueRelationsInput
> = builder.prismaUpdate('WithUnique', {
  name: 'WithUniqueUpdateWithoutFindUniqueRelations',
  fields: () => ({
    id: 'String',
  }),
});
export const FindUniqueRelationsUpdateWithUnique = builder.prismaUpdateRelation(
  'FindUniqueRelations',
  'withUnique',
  {
    fields: () => ({
      create: WithUniqueCreateWithoutFindUniqueRelations,
      update: WithUniqueUpdateWithoutFindUniqueRelations,
      connect: WithUniqueUniqueFilter,
    }),
  },
);
export const WithCompositeIDUpdateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeIDUpdateWithoutFindUniqueRelationsInput
> = builder.prismaUpdate('WithCompositeID', {
  name: 'WithCompositeIDUpdateWithoutFindUniqueRelations',
  fields: () => ({
    a: 'String',
    b: 'String',
  }),
});
export const FindUniqueRelationsUpdateWithCompositeID = builder.prismaUpdateRelation(
  'FindUniqueRelations',
  'withCompositeID',
  {
    fields: () => ({
      create: WithCompositeIDCreateWithoutFindUniqueRelations,
      update: WithCompositeIDUpdateWithoutFindUniqueRelations,
      connect: WithCompositeIDUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueUpdateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueUpdateWithoutFindUniqueRelationsInput
> = builder.prismaUpdate('WithCompositeUnique', {
  name: 'WithCompositeUniqueUpdateWithoutFindUniqueRelations',
  fields: () => ({
    a: 'String',
    c: 'String',
    b: 'String',
  }),
});
export const FindUniqueRelationsUpdateWithCompositeUnique = builder.prismaUpdateRelation(
  'FindUniqueRelations',
  'withCompositeUnique',
  {
    fields: () => ({
      create: WithCompositeUniqueCreateWithoutFindUniqueRelations,
      update: WithCompositeUniqueUpdateWithoutFindUniqueRelations,
      connect: WithCompositeUniqueUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsUpdateWithoutWithID: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsUpdateWithoutWithIDInput
> = builder.prismaUpdate('FindUniqueRelations', {
  name: 'FindUniqueRelationsUpdateWithoutWithID',
  fields: () => ({
    id: 'String',
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsUpdateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsUpdateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsUpdateWithCompositeUnique,
  }),
});
export const FindUniqueRelationsWithoutWithIDFilter: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsWhereInput
> = builder.prismaWhere('FindUniqueRelations', {
  name: 'FindUniqueRelationsWithoutWithIDFilter',
  fields: () => ({
    id: StringFilter,
    withUnique_id: StringFilter,
    withUnique: WithUniqueFilter,
    withCompositeID_a: StringFilter,
    withCompositeID_b: StringFilter,
    withCompositeID: WithCompositeIDFilter,
    withCompositeUnique_a: StringFilter,
    withCompositeUnique_b: StringFilter,
    withCompositeUnique: WithCompositeUniqueFilter,
  }),
});
export const WithIDUpdateFindUniqueRelations = builder.prismaUpdateRelation(
  'WithID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithID,
      set: FindUniqueRelationsUniqueFilter,
      disconnect: FindUniqueRelationsUniqueFilter,
      delete: FindUniqueRelationsUniqueFilter,
      connect: FindUniqueRelationsUniqueFilter,
      update: {
        where: FindUniqueRelationsUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithID,
      },
      updateMany: {
        where: FindUniqueRelationsWithoutWithIDFilter,
        data: FindUniqueRelationsUpdateWithoutWithID,
      },
      deleteMany: FindUniqueRelationsWithoutWithIDFilter,
    }),
  },
);
export const WithIDUpdate: InputObjectRef<Types, Prisma.Prisma.WithIDUpdateInput> =
  builder.prismaUpdate('WithID', {
    name: 'WithIDUpdate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithIDUpdateFindUniqueRelations,
    }),
  });
export const WithIDCreateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithIDCreateWithoutFindUniqueRelationsInput
> = builder.prismaCreate('WithID', {
  name: 'WithIDCreateWithoutFindUniqueRelations',
  fields: () => ({
    id: 'String',
  }),
});
export const FindUniqueRelationsCreateWithID = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withID',
  {
    fields: () => ({
      create: WithIDCreateWithoutFindUniqueRelations,
      connect: WithIDUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsCreateWithoutWithUnique: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsCreateWithoutWithUniqueInput
> = builder.prismaCreate('FindUniqueRelations', {
  name: 'FindUniqueRelationsCreateWithoutWithUnique',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsCreateWithID,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsCreateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsCreateWithCompositeUnique,
  }),
});
export const WithUniqueCreateFindUniqueRelations = builder.prismaCreateRelation(
  'WithUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithUnique,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithUniqueCreate: InputObjectRef<Types, Prisma.Prisma.WithUniqueCreateInput> =
  builder.prismaCreate('WithUnique', {
    name: 'WithUniqueCreate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithUniqueCreateFindUniqueRelations,
    }),
  });
export const WithIDUpdateWithoutFindUniqueRelations: InputObjectRef<
  Types,
  Prisma.Prisma.WithIDUpdateWithoutFindUniqueRelationsInput
> = builder.prismaUpdate('WithID', {
  name: 'WithIDUpdateWithoutFindUniqueRelations',
  fields: () => ({
    id: 'String',
  }),
});
export const FindUniqueRelationsUpdateWithID = builder.prismaUpdateRelation(
  'FindUniqueRelations',
  'withID',
  {
    fields: () => ({
      create: WithIDCreateWithoutFindUniqueRelations,
      update: WithIDUpdateWithoutFindUniqueRelations,
      connect: WithIDUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsUpdateWithoutWithUnique: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsUpdateWithoutWithUniqueInput
> = builder.prismaUpdate('FindUniqueRelations', {
  name: 'FindUniqueRelationsUpdateWithoutWithUnique',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsUpdateWithID,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsUpdateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsUpdateWithCompositeUnique,
  }),
});
export const FindUniqueRelationsWithoutWithUniqueFilter: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsWhereInput
> = builder.prismaWhere('FindUniqueRelations', {
  name: 'FindUniqueRelationsWithoutWithUniqueFilter',
  fields: () => ({
    id: StringFilter,
    withID_id: StringFilter,
    withID: WithIDFilter,
    withCompositeID_a: StringFilter,
    withCompositeID_b: StringFilter,
    withCompositeID: WithCompositeIDFilter,
    withCompositeUnique_a: StringFilter,
    withCompositeUnique_b: StringFilter,
    withCompositeUnique: WithCompositeUniqueFilter,
  }),
});
export const WithUniqueUpdateFindUniqueRelations = builder.prismaUpdateRelation(
  'WithUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithUnique,
      set: FindUniqueRelationsUniqueFilter,
      disconnect: FindUniqueRelationsUniqueFilter,
      delete: FindUniqueRelationsUniqueFilter,
      connect: FindUniqueRelationsUniqueFilter,
      update: {
        where: FindUniqueRelationsUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithUnique,
      },
      updateMany: {
        where: FindUniqueRelationsWithoutWithUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithUnique,
      },
      deleteMany: FindUniqueRelationsWithoutWithUniqueFilter,
    }),
  },
);
export const WithUniqueUpdate: InputObjectRef<Types, Prisma.Prisma.WithUniqueUpdateInput> =
  builder.prismaUpdate('WithUnique', {
    name: 'WithUniqueUpdate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithUniqueUpdateFindUniqueRelations,
    }),
  });
export const FindUniqueRelationsCreateWithoutWithCompositeID: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsCreateWithoutWithCompositeIDInput
> = builder.prismaCreate('FindUniqueRelations', {
  name: 'FindUniqueRelationsCreateWithoutWithCompositeID',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsCreateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsCreateWithUnique,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsCreateWithCompositeUnique,
  }),
});
export const WithCompositeIDCreateFindUniqueRelations = builder.prismaCreateRelation(
  'WithCompositeID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeID,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithCompositeIDCreate: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeIDCreateInput
> = builder.prismaCreate('WithCompositeID', {
  name: 'WithCompositeIDCreate',
  fields: () => ({
    a: 'String',
    b: 'String',
    FindUniqueRelations: WithCompositeIDCreateFindUniqueRelations,
  }),
});
export const FindUniqueRelationsUpdateWithoutWithCompositeID: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsUpdateWithoutWithCompositeIDInput
> = builder.prismaUpdate('FindUniqueRelations', {
  name: 'FindUniqueRelationsUpdateWithoutWithCompositeID',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsUpdateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsUpdateWithUnique,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsUpdateWithCompositeUnique,
  }),
});
export const FindUniqueRelationsWithoutWithCompositeIDFilter: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsWhereInput
> = builder.prismaWhere('FindUniqueRelations', {
  name: 'FindUniqueRelationsWithoutWithCompositeIDFilter',
  fields: () => ({
    id: StringFilter,
    withID_id: StringFilter,
    withID: WithIDFilter,
    withUnique_id: StringFilter,
    withUnique: WithUniqueFilter,
    withCompositeUnique_a: StringFilter,
    withCompositeUnique_b: StringFilter,
    withCompositeUnique: WithCompositeUniqueFilter,
  }),
});
export const WithCompositeIDUpdateFindUniqueRelations = builder.prismaUpdateRelation(
  'WithCompositeID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeID,
      set: FindUniqueRelationsUniqueFilter,
      disconnect: FindUniqueRelationsUniqueFilter,
      delete: FindUniqueRelationsUniqueFilter,
      connect: FindUniqueRelationsUniqueFilter,
      update: {
        where: FindUniqueRelationsUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithCompositeID,
      },
      updateMany: {
        where: FindUniqueRelationsWithoutWithCompositeIDFilter,
        data: FindUniqueRelationsUpdateWithoutWithCompositeID,
      },
      deleteMany: FindUniqueRelationsWithoutWithCompositeIDFilter,
    }),
  },
);
export const WithCompositeIDUpdate: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeIDUpdateInput
> = builder.prismaUpdate('WithCompositeID', {
  name: 'WithCompositeIDUpdate',
  fields: () => ({
    a: 'String',
    b: 'String',
    FindUniqueRelations: WithCompositeIDUpdateFindUniqueRelations,
  }),
});
export const FindUniqueRelationsCreateWithoutWithCompositeUnique: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsCreateWithoutWithCompositeUniqueInput
> = builder.prismaCreate('FindUniqueRelations', {
  name: 'FindUniqueRelationsCreateWithoutWithCompositeUnique',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsCreateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsCreateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsCreateWithCompositeID,
  }),
});
export const WithCompositeUniqueCreateFindUniqueRelations = builder.prismaCreateRelation(
  'WithCompositeUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeUnique,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueCreate: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueCreateInput
> = builder.prismaCreate('WithCompositeUnique', {
  name: 'WithCompositeUniqueCreate',
  fields: () => ({
    a: 'String',
    c: 'String',
    b: 'String',
    FindUniqueRelations: WithCompositeUniqueCreateFindUniqueRelations,
  }),
});
export const FindUniqueRelationsUpdateWithoutWithCompositeUnique: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsUpdateWithoutWithCompositeUniqueInput
> = builder.prismaUpdate('FindUniqueRelations', {
  name: 'FindUniqueRelationsUpdateWithoutWithCompositeUnique',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsUpdateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsUpdateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsUpdateWithCompositeID,
  }),
});
export const FindUniqueRelationsWithoutWithCompositeUniqueFilter: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsWhereInput
> = builder.prismaWhere('FindUniqueRelations', {
  name: 'FindUniqueRelationsWithoutWithCompositeUniqueFilter',
  fields: () => ({
    id: StringFilter,
    withID_id: StringFilter,
    withID: WithIDFilter,
    withUnique_id: StringFilter,
    withUnique: WithUniqueFilter,
    withCompositeID_a: StringFilter,
    withCompositeID_b: StringFilter,
    withCompositeID: WithCompositeIDFilter,
  }),
});
export const WithCompositeUniqueUpdateFindUniqueRelations = builder.prismaUpdateRelation(
  'WithCompositeUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeUnique,
      set: FindUniqueRelationsUniqueFilter,
      disconnect: FindUniqueRelationsUniqueFilter,
      delete: FindUniqueRelationsUniqueFilter,
      connect: FindUniqueRelationsUniqueFilter,
      update: {
        where: FindUniqueRelationsUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithCompositeUnique,
      },
      updateMany: {
        where: FindUniqueRelationsWithoutWithCompositeUniqueFilter,
        data: FindUniqueRelationsUpdateWithoutWithCompositeUnique,
      },
      deleteMany: FindUniqueRelationsWithoutWithCompositeUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueUpdate: InputObjectRef<
  Types,
  Prisma.Prisma.WithCompositeUniqueUpdateInput
> = builder.prismaUpdate('WithCompositeUnique', {
  name: 'WithCompositeUniqueUpdate',
  fields: () => ({
    a: 'String',
    c: 'String',
    b: 'String',
    FindUniqueRelations: WithCompositeUniqueUpdateFindUniqueRelations,
  }),
});
export const FindUniqueRelationsCreate: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsCreateInput
> = builder.prismaCreate('FindUniqueRelations', {
  name: 'FindUniqueRelationsCreate',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsCreateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsCreateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsCreateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsCreateWithCompositeUnique,
  }),
});
export const FindUniqueRelationsUpdate: InputObjectRef<
  Types,
  Prisma.Prisma.FindUniqueRelationsUpdateInput
> = builder.prismaUpdate('FindUniqueRelations', {
  name: 'FindUniqueRelationsUpdate',
  fields: () => ({
    id: 'String',
    withID_id: 'String',
    withID: FindUniqueRelationsUpdateWithID,
    withUnique_id: 'String',
    withUnique: FindUniqueRelationsUpdateWithUnique,
    withCompositeID_a: 'String',
    withCompositeID_b: 'String',
    withCompositeID: FindUniqueRelationsUpdateWithCompositeID,
    withCompositeUnique_a: 'String',
    withCompositeUnique_b: 'String',
    withCompositeUnique: FindUniqueRelationsUpdateWithCompositeUnique,
  }),
});
