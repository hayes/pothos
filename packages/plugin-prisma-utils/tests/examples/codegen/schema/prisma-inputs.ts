import { InputObjectRef } from '@pothos/core';
import * as Prisma from '../../../client';
import { builder } from '../builder';

builder.enumType(Prisma.Category, {
  name: 'Category',
});
export const PostFilter: InputObjectRef<Prisma.Prisma.PostWhereInput> = builder.prismaWhere(
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
export const UserFilter: InputObjectRef<Prisma.Prisma.UserWhereInput> = builder.prismaWhere(
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
export const CommentFilter: InputObjectRef<Prisma.Prisma.CommentWhereInput> = builder.prismaWhere(
  'Comment',
  {
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
  },
);
export const CommentListFilter = builder.prismaListFilter(CommentFilter, {
  name: 'CommentListFilter',
  ops: ['every', 'some', 'none'],
});
export const ProfileFilter: InputObjectRef<Prisma.Prisma.ProfileWhereInput> = builder.prismaWhere(
  'Profile',
  {
    name: 'ProfileFilter',
    fields: () => ({
      id: IntFilter,
      bio: StringFilter,
      user: UserFilter,
      userId: IntFilter,
    }),
  },
);
export const FollowFilter: InputObjectRef<Prisma.Prisma.FollowWhereInput> = builder.prismaWhere(
  'Follow',
  {
    name: 'FollowFilter',
    fields: () => ({
      fromId: IntFilter,
      toId: IntFilter,
      from: UserFilter,
      to: UserFilter,
    }),
  },
);
export const FollowListFilter = builder.prismaListFilter(FollowFilter, {
  name: 'FollowListFilter',
  ops: ['every', 'some', 'none'],
});
export const MediaFilter: InputObjectRef<Prisma.Prisma.MediaWhereInput> = builder.prismaWhere(
  'Media',
  {
    name: 'MediaFilter',
    fields: () => ({
      id: IntFilter,
      url: StringFilter,
      posts: PostMediaListFilter,
      uploadedBy: UserFilter,
      uploadedById: IntFilter,
    }),
  },
);
export const PostMediaFilter: InputObjectRef<Prisma.Prisma.PostMediaWhereInput> =
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
export const StringListFilter = builder.prismaListFilter(StringFilter, {
  name: 'StringListFilter',
  ops: ['every', 'some', 'none'],
});
export const CategoryFilter = builder.prismaFilter(Prisma.Category, {
  name: 'CategoryFilter',
  ops: ['equals', 'in', 'notIn', 'not', 'is', 'isNot'],
});
export const CategoryListFilter = builder.prismaListFilter(CategoryFilter, {
  name: 'CategoryListFilter',
  ops: ['every', 'some', 'none'],
});
export const PostUniqueFilter = builder.prismaWhereUnique('Post', {
  name: 'PostUniqueFilter',
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
  }),
});
export const CommentOrderBy: InputObjectRef<Prisma.Prisma.CommentOrderByWithRelationInput> =
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
export const ProfileOrderBy: InputObjectRef<Prisma.Prisma.ProfileOrderByWithRelationInput> =
  builder.prismaOrderBy('Profile', {
    name: 'ProfileOrderBy',
    fields: () => ({
      id: true,
      bio: true,
      user: UserOrderBy,
      userId: true,
    }),
  });
export const FollowOrderBy: InputObjectRef<Prisma.Prisma.FollowOrderByWithRelationInput> =
  builder.prismaOrderBy('Follow', {
    name: 'FollowOrderBy',
    fields: () => ({
      fromId: true,
      toId: true,
      from: UserOrderBy,
      to: UserOrderBy,
    }),
  });
export const PostMediaOrderBy: InputObjectRef<Prisma.Prisma.PostMediaOrderByWithRelationInput> =
  builder.prismaOrderBy('PostMedia', {
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
export const MediaOrderBy: InputObjectRef<Prisma.Prisma.MediaOrderByWithRelationInput> =
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
export const UserOrderBy: InputObjectRef<Prisma.Prisma.UserOrderByWithRelationInput> =
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
export const PostOrderBy: InputObjectRef<Prisma.Prisma.PostOrderByWithRelationInput> =
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
    }),
  });
export const ProfileCreateWithoutUser: InputObjectRef<Prisma.Prisma.ProfileCreateWithoutUserInput> =
  builder.prismaCreate('Profile', {
    name: 'ProfileCreateWithoutUser',
    fields: () => ({
      id: 'Int',
      bio: 'String',
    }),
  });
export const ProfileUniqueFilter = builder.prismaWhereUnique('Profile', {
  name: 'ProfileUniqueFilter',
  fields: () => ({
    id: IntFilter,
    bio: StringFilter,
    user: UserFilter,
    userId: IntFilter,
  }),
});
export const UserProfile = builder.prismaCreateRelation('User', 'profile', {
  fields: () => ({
    create: ProfileCreateWithoutUser,
    connect: ProfileUniqueFilter,
  }),
});
export const PostCreateWithoutMedia: InputObjectRef<Prisma.Prisma.PostCreateWithoutMediaInput> =
  builder.prismaCreate('Post', {
    name: 'PostCreateWithoutMedia',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostAuthor,
      comments: PostComments,
      authorId: 'Int',
      tags: 'String',
      categories: Prisma.Category,
    }),
  });
export const PostMediaPost = builder.prismaCreateRelation('PostMedia', 'post', {
  fields: () => ({
    create: PostCreateWithoutMedia,
    connect: PostUniqueFilter,
  }),
});
export const PostMediaCreateWithoutMedia: InputObjectRef<Prisma.Prisma.PostMediaCreateWithoutMediaInput> =
  builder.prismaCreate('PostMedia', {
    name: 'PostMediaCreateWithoutMedia',
    fields: () => ({
      id: 'Int',
      post: PostMediaPost,
      postId: 'Int',
      order: 'Int',
    }),
  });
export const PostMediaUniqueFilter = builder.prismaWhereUnique('PostMedia', {
  name: 'PostMediaUniqueFilter',
  fields: () => ({
    id: IntFilter,
    post: PostFilter,
    media: MediaFilter,
    postId: IntFilter,
    mediaId: IntFilter,
    order: IntFilter,
  }),
});
export const MediaPosts = builder.prismaCreateRelation('Media', 'posts', {
  fields: () => ({
    create: PostMediaCreateWithoutMedia,
    connect: PostMediaUniqueFilter,
  }),
});
export const MediaCreateWithoutUploadedBy: InputObjectRef<Prisma.Prisma.MediaCreateWithoutUploadedByInput> =
  builder.prismaCreate('Media', {
    name: 'MediaCreateWithoutUploadedBy',
    fields: () => ({
      id: 'Int',
      url: 'String',
      posts: MediaPosts,
    }),
  });
export const MediaUniqueFilter = builder.prismaWhereUnique('Media', {
  name: 'MediaUniqueFilter',
  fields: () => ({
    id: IntFilter,
    url: StringFilter,
    posts: PostMediaListFilter,
    uploadedBy: UserFilter,
    uploadedById: IntFilter,
  }),
});
export const UserMedia = builder.prismaCreateRelation('User', 'Media', {
  fields: () => ({
    create: MediaCreateWithoutUploadedBy,
    connect: MediaUniqueFilter,
  }),
});
export const UserCreateWithoutFollowing: InputObjectRef<Prisma.Prisma.UserCreateWithoutFollowingInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutFollowing',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      profile: UserProfile,
      followers: UserFollowers,
      Media: UserMedia,
    }),
  });
export const UserUniqueFilter = builder.prismaWhereUnique('User', {
  name: 'UserUniqueFilter',
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
});
export const FollowFrom = builder.prismaCreateRelation('Follow', 'from', {
  fields: () => ({
    create: UserCreateWithoutFollowing,
    connect: UserUniqueFilter,
  }),
});
export const FollowCreateWithoutTo: InputObjectRef<Prisma.Prisma.FollowCreateWithoutToInput> =
  builder.prismaCreate('Follow', {
    name: 'FollowCreateWithoutTo',
    fields: () => ({
      fromId: 'Int',
      from: FollowFrom,
    }),
  });
export const FollowUniqueFilter = builder.prismaWhereUnique('Follow', {
  name: 'FollowUniqueFilter',
  fields: () => ({
    fromId: IntFilter,
    toId: IntFilter,
    from: UserFilter,
    to: UserFilter,
  }),
});
export const UserFollowers = builder.prismaCreateRelation('User', 'followers', {
  fields: () => ({
    create: FollowCreateWithoutTo,
    connect: FollowUniqueFilter,
  }),
});
export const UserCreateWithoutFollowers: InputObjectRef<Prisma.Prisma.UserCreateWithoutFollowersInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutFollowers',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      profile: UserProfile,
      following: UserFollowing,
      Media: UserMedia,
    }),
  });
export const FollowTo = builder.prismaCreateRelation('Follow', 'to', {
  fields: () => ({
    create: UserCreateWithoutFollowers,
    connect: UserUniqueFilter,
  }),
});
export const FollowCreateWithoutFrom: InputObjectRef<Prisma.Prisma.FollowCreateWithoutFromInput> =
  builder.prismaCreate('Follow', {
    name: 'FollowCreateWithoutFrom',
    fields: () => ({
      toId: 'Int',
      to: FollowTo,
    }),
  });
export const UserFollowing = builder.prismaCreateRelation('User', 'following', {
  fields: () => ({
    create: FollowCreateWithoutFrom,
    connect: FollowUniqueFilter,
  }),
});
export const UserCreateWithoutComments: InputObjectRef<Prisma.Prisma.UserCreateWithoutCommentsInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutComments',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      profile: UserProfile,
      followers: UserFollowers,
      following: UserFollowing,
      Media: UserMedia,
    }),
  });
export const CommentAuthor = builder.prismaCreateRelation('Comment', 'author', {
  fields: () => ({
    create: UserCreateWithoutComments,
    connect: UserUniqueFilter,
  }),
});
export const CommentCreateWithoutPost: InputObjectRef<Prisma.Prisma.CommentCreateWithoutPostInput> =
  builder.prismaCreate('Comment', {
    name: 'CommentCreateWithoutPost',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      author: CommentAuthor,
      authorId: 'Int',
    }),
  });
export const CommentUniqueFilter = builder.prismaWhereUnique('Comment', {
  name: 'CommentUniqueFilter',
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
export const PostComments = builder.prismaCreateRelation('Post', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutPost,
    connect: CommentUniqueFilter,
  }),
});
export const PostCreateWithoutAuthor: InputObjectRef<Prisma.Prisma.PostCreateWithoutAuthorInput> =
  builder.prismaCreate('Post', {
    name: 'PostCreateWithoutAuthor',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      comments: PostComments,
      media: PostMedia,
      tags: 'String',
      categories: Prisma.Category,
    }),
  });
export const UserPosts = builder.prismaCreateRelation('User', 'posts', {
  fields: () => ({
    create: PostCreateWithoutAuthor,
    connect: PostUniqueFilter,
  }),
});
export const UserCreateWithoutMedia: InputObjectRef<Prisma.Prisma.UserCreateWithoutMediaInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutMedia',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      profile: UserProfile,
      followers: UserFollowers,
      following: UserFollowing,
    }),
  });
export const MediaUploadedBy = builder.prismaCreateRelation('Media', 'uploadedBy', {
  fields: () => ({
    create: UserCreateWithoutMedia,
    connect: UserUniqueFilter,
  }),
});
export const MediaCreateWithoutPosts: InputObjectRef<Prisma.Prisma.MediaCreateWithoutPostsInput> =
  builder.prismaCreate('Media', {
    name: 'MediaCreateWithoutPosts',
    fields: () => ({
      id: 'Int',
      url: 'String',
      uploadedBy: MediaUploadedBy,
      uploadedById: 'Int',
    }),
  });
export const PostMediaMedia = builder.prismaCreateRelation('PostMedia', 'media', {
  fields: () => ({
    create: MediaCreateWithoutPosts,
    connect: MediaUniqueFilter,
  }),
});
export const PostMediaCreateWithoutPost: InputObjectRef<Prisma.Prisma.PostMediaCreateWithoutPostInput> =
  builder.prismaCreate('PostMedia', {
    name: 'PostMediaCreateWithoutPost',
    fields: () => ({
      id: 'Int',
      media: PostMediaMedia,
      mediaId: 'Int',
      order: 'Int',
    }),
  });
export const PostMedia = builder.prismaCreateRelation('Post', 'media', {
  fields: () => ({
    create: PostMediaCreateWithoutPost,
    connect: PostMediaUniqueFilter,
  }),
});
export const PostCreateWithoutComments: InputObjectRef<Prisma.Prisma.PostCreateWithoutCommentsInput> =
  builder.prismaCreate('Post', {
    name: 'PostCreateWithoutComments',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostAuthor,
      authorId: 'Int',
      media: PostMedia,
      tags: 'String',
      categories: Prisma.Category,
    }),
  });
export const CommentPost = builder.prismaCreateRelation('Comment', 'post', {
  fields: () => ({
    create: PostCreateWithoutComments,
    connect: PostUniqueFilter,
  }),
});
export const CommentCreateWithoutAuthor: InputObjectRef<Prisma.Prisma.CommentCreateWithoutAuthorInput> =
  builder.prismaCreate('Comment', {
    name: 'CommentCreateWithoutAuthor',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      post: CommentPost,
      postId: 'Int',
    }),
  });
export const UserComments = builder.prismaCreateRelation('User', 'comments', {
  fields: () => ({
    create: CommentCreateWithoutAuthor,
    connect: CommentUniqueFilter,
  }),
});
export const UserCreateWithoutPosts: InputObjectRef<Prisma.Prisma.UserCreateWithoutPostsInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutPosts',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      comments: UserComments,
      profile: UserProfile,
      followers: UserFollowers,
      following: UserFollowing,
      Media: UserMedia,
    }),
  });
export const PostAuthor = builder.prismaCreateRelation('Post', 'author', {
  fields: () => ({
    create: UserCreateWithoutPosts,
    connect: UserUniqueFilter,
  }),
});
export const PostCreate: InputObjectRef<Prisma.Prisma.PostCreateInput> = builder.prismaCreate(
  'Post',
  {
    name: 'PostCreate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostAuthor,
      comments: PostComments,
      authorId: 'Int',
      media: PostMedia,
      tags: 'String',
      categories: Prisma.Category,
    }),
  },
);
export const PostUpdate: InputObjectRef<Prisma.Prisma.PostUpdateInput> = builder.prismaUpdate(
  'Post',
  {
    name: 'PostUpdate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      updatedAt: 'DateTime',
      title: 'String',
      content: 'String',
      published: 'Boolean',
      author: PostAuthor,
      comments: PostComments,
      authorId: 'Int',
      media: PostMedia,
      tags: 'String',
      categories: Prisma.Category,
    }),
  },
);
export const MediaCreate: InputObjectRef<Prisma.Prisma.MediaCreateInput> = builder.prismaCreate(
  'Media',
  {
    name: 'MediaCreate',
    fields: () => ({
      id: 'Int',
      url: 'String',
      posts: MediaPosts,
      uploadedBy: MediaUploadedBy,
      uploadedById: 'Int',
    }),
  },
);
export const MediaUpdate: InputObjectRef<Prisma.Prisma.MediaUpdateInput> = builder.prismaUpdate(
  'Media',
  {
    name: 'MediaUpdate',
    fields: () => ({
      id: 'Int',
      url: 'String',
      posts: MediaPosts,
      uploadedBy: MediaUploadedBy,
      uploadedById: 'Int',
    }),
  },
);
export const PostMediaCreate: InputObjectRef<Prisma.Prisma.PostMediaCreateInput> =
  builder.prismaCreate('PostMedia', {
    name: 'PostMediaCreate',
    fields: () => ({
      id: 'Int',
      post: PostMediaPost,
      media: PostMediaMedia,
      postId: 'Int',
      mediaId: 'Int',
      order: 'Int',
    }),
  });
export const PostMediaUpdate: InputObjectRef<Prisma.Prisma.PostMediaUpdateInput> =
  builder.prismaUpdate('PostMedia', {
    name: 'PostMediaUpdate',
    fields: () => ({
      id: 'Int',
      post: PostMediaPost,
      media: PostMediaMedia,
      postId: 'Int',
      mediaId: 'Int',
      order: 'Int',
    }),
  });
export const CommentCreate: InputObjectRef<Prisma.Prisma.CommentCreateInput> = builder.prismaCreate(
  'Comment',
  {
    name: 'CommentCreate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      author: CommentAuthor,
      post: CommentPost,
      authorId: 'Int',
      postId: 'Int',
    }),
  },
);
export const CommentUpdate: InputObjectRef<Prisma.Prisma.CommentUpdateInput> = builder.prismaUpdate(
  'Comment',
  {
    name: 'CommentUpdate',
    fields: () => ({
      id: 'Int',
      createdAt: 'DateTime',
      content: 'String',
      author: CommentAuthor,
      post: CommentPost,
      authorId: 'Int',
      postId: 'Int',
    }),
  },
);
export const UserCreateWithoutProfile: InputObjectRef<Prisma.Prisma.UserCreateWithoutProfileInput> =
  builder.prismaCreate('User', {
    name: 'UserCreateWithoutProfile',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      followers: UserFollowers,
      following: UserFollowing,
      Media: UserMedia,
    }),
  });
export const ProfileUser = builder.prismaCreateRelation('Profile', 'user', {
  fields: () => ({
    create: UserCreateWithoutProfile,
    connect: UserUniqueFilter,
  }),
});
export const ProfileCreate: InputObjectRef<Prisma.Prisma.ProfileCreateInput> = builder.prismaCreate(
  'Profile',
  {
    name: 'ProfileCreate',
    fields: () => ({
      id: 'Int',
      bio: 'String',
      user: ProfileUser,
      userId: 'Int',
    }),
  },
);
export const ProfileUpdate: InputObjectRef<Prisma.Prisma.ProfileUpdateInput> = builder.prismaUpdate(
  'Profile',
  {
    name: 'ProfileUpdate',
    fields: () => ({
      id: 'Int',
      bio: 'String',
      user: ProfileUser,
      userId: 'Int',
    }),
  },
);
export const UserCreate: InputObjectRef<Prisma.Prisma.UserCreateInput> = builder.prismaCreate(
  'User',
  {
    name: 'UserCreate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      profile: UserProfile,
      followers: UserFollowers,
      following: UserFollowing,
      Media: UserMedia,
    }),
  },
);
export const UserUpdate: InputObjectRef<Prisma.Prisma.UserUpdateInput> = builder.prismaUpdate(
  'User',
  {
    name: 'UserUpdate',
    fields: () => ({
      id: 'Int',
      email: 'String',
      name: 'String',
      posts: UserPosts,
      comments: UserComments,
      profile: UserProfile,
      followers: UserFollowers,
      following: UserFollowing,
      Media: UserMedia,
    }),
  },
);
export const FollowCreate: InputObjectRef<Prisma.Prisma.FollowCreateInput> = builder.prismaCreate(
  'Follow',
  {
    name: 'FollowCreate',
    fields: () => ({
      fromId: 'Int',
      toId: 'Int',
      from: FollowFrom,
      to: FollowTo,
    }),
  },
);
export const FollowUpdate: InputObjectRef<Prisma.Prisma.FollowUpdateInput> = builder.prismaUpdate(
  'Follow',
  {
    name: 'FollowUpdate',
    fields: () => ({
      fromId: 'Int',
      toId: 'Int',
      from: FollowFrom,
      to: FollowTo,
    }),
  },
);
export const UnrelatedFilter: InputObjectRef<Prisma.Prisma.UnrelatedWhereInput> =
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
    id: IntFilter,
    name: StringFilter,
  }),
});
export const UnrelatedOrderBy: InputObjectRef<Prisma.Prisma.UnrelatedOrderByWithRelationInput> =
  builder.prismaOrderBy('Unrelated', {
    name: 'UnrelatedOrderBy',
    fields: () => ({
      id: true,
      name: true,
    }),
  });
export const UnrelatedCreate: InputObjectRef<Prisma.Prisma.UnrelatedCreateInput> =
  builder.prismaCreate('Unrelated', {
    name: 'UnrelatedCreate',
    fields: () => ({
      id: 'Int',
      name: 'String',
    }),
  });
export const UnrelatedUpdate: InputObjectRef<Prisma.Prisma.UnrelatedUpdateInput> =
  builder.prismaUpdate('Unrelated', {
    name: 'UnrelatedUpdate',
    fields: () => ({
      id: 'Int',
      name: 'String',
    }),
  });
export const WithIDFilter: InputObjectRef<Prisma.Prisma.WithIDWhereInput> = builder.prismaWhere(
  'WithID',
  {
    name: 'WithIDFilter',
    fields: () => ({
      id: StringFilter,
      FindUniqueRelations: FindUniqueRelationsListFilter,
    }),
  },
);
export const FindUniqueRelationsFilter: InputObjectRef<Prisma.Prisma.FindUniqueRelationsWhereInput> =
  builder.prismaWhere('FindUniqueRelations', {
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
export const WithUniqueFilter: InputObjectRef<Prisma.Prisma.WithUniqueWhereInput> =
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
export const WithCompositeIDFilter: InputObjectRef<Prisma.Prisma.WithCompositeIDWhereInput> =
  builder.prismaWhere('WithCompositeID', {
    name: 'WithCompositeIDFilter',
    fields: () => ({
      a: StringFilter,
      b: StringFilter,
      FindUniqueRelations: FindUniqueRelationsListFilter,
    }),
  });
export const WithCompositeUniqueFilter: InputObjectRef<Prisma.Prisma.WithCompositeUniqueWhereInput> =
  builder.prismaWhere('WithCompositeUnique', {
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
    id: StringFilter,
    FindUniqueRelations: FindUniqueRelationsListFilter,
  }),
});
export const WithUniqueOrderBy: InputObjectRef<Prisma.Prisma.WithUniqueOrderByWithRelationInput> =
  builder.prismaOrderBy('WithUnique', {
    name: 'WithUniqueOrderBy',
    fields: () => ({
      id: true,
      FindUniqueRelations: FindUniqueRelationsOrderBy,
    }),
  });
export const WithCompositeIDOrderBy: InputObjectRef<Prisma.Prisma.WithCompositeIDOrderByWithRelationInput> =
  builder.prismaOrderBy('WithCompositeID', {
    name: 'WithCompositeIDOrderBy',
    fields: () => ({
      a: true,
      b: true,
      FindUniqueRelations: FindUniqueRelationsOrderBy,
    }),
  });
export const WithCompositeUniqueOrderBy: InputObjectRef<Prisma.Prisma.WithCompositeUniqueOrderByWithRelationInput> =
  builder.prismaOrderBy('WithCompositeUnique', {
    name: 'WithCompositeUniqueOrderBy',
    fields: () => ({
      a: true,
      c: true,
      b: true,
      FindUniqueRelations: FindUniqueRelationsOrderBy,
    }),
  });
export const FindUniqueRelationsOrderBy: InputObjectRef<Prisma.Prisma.FindUniqueRelationsOrderByWithRelationInput> =
  builder.prismaOrderBy('FindUniqueRelations', {
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
export const WithIDOrderBy: InputObjectRef<Prisma.Prisma.WithIDOrderByWithRelationInput> =
  builder.prismaOrderBy('WithID', {
    name: 'WithIDOrderBy',
    fields: () => ({
      id: true,
      FindUniqueRelations: FindUniqueRelationsOrderBy,
    }),
  });
export const WithUniqueCreateWithoutFindUniqueRelations: InputObjectRef<Prisma.Prisma.WithUniqueCreateWithoutFindUniqueRelationsInput> =
  builder.prismaCreate('WithUnique', {
    name: 'WithUniqueCreateWithoutFindUniqueRelations',
    fields: () => ({
      id: 'String',
    }),
  });
export const WithUniqueUniqueFilter = builder.prismaWhereUnique('WithUnique', {
  name: 'WithUniqueUniqueFilter',
  fields: () => ({
    id: StringFilter,
    FindUniqueRelations: FindUniqueRelationsListFilter,
  }),
});
export const FindUniqueRelationsWithUnique = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withUnique',
  {
    fields: () => ({
      create: WithUniqueCreateWithoutFindUniqueRelations,
      connect: WithUniqueUniqueFilter,
    }),
  },
);
export const WithCompositeIDCreateWithoutFindUniqueRelations: InputObjectRef<Prisma.Prisma.WithCompositeIDCreateWithoutFindUniqueRelationsInput> =
  builder.prismaCreate('WithCompositeID', {
    name: 'WithCompositeIDCreateWithoutFindUniqueRelations',
    fields: () => ({
      a: 'String',
      b: 'String',
    }),
  });
export const WithCompositeIDUniqueFilter = builder.prismaWhereUnique('WithCompositeID', {
  name: 'WithCompositeIDUniqueFilter',
  fields: () => ({
    a: StringFilter,
    b: StringFilter,
    FindUniqueRelations: FindUniqueRelationsListFilter,
  }),
});
export const FindUniqueRelationsWithCompositeID = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withCompositeID',
  {
    fields: () => ({
      create: WithCompositeIDCreateWithoutFindUniqueRelations,
      connect: WithCompositeIDUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueCreateWithoutFindUniqueRelations: InputObjectRef<Prisma.Prisma.WithCompositeUniqueCreateWithoutFindUniqueRelationsInput> =
  builder.prismaCreate('WithCompositeUnique', {
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
    a: StringFilter,
    c: StringFilter,
    b: StringFilter,
    FindUniqueRelations: FindUniqueRelationsListFilter,
  }),
});
export const FindUniqueRelationsWithCompositeUnique = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withCompositeUnique',
  {
    fields: () => ({
      create: WithCompositeUniqueCreateWithoutFindUniqueRelations,
      connect: WithCompositeUniqueUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsCreateWithoutWithID: InputObjectRef<Prisma.Prisma.FindUniqueRelationsCreateWithoutWithIDInput> =
  builder.prismaCreate('FindUniqueRelations', {
    name: 'FindUniqueRelationsCreateWithoutWithID',
    fields: () => ({
      id: 'String',
      withUnique_id: 'String',
      withUnique: FindUniqueRelationsWithUnique,
      withCompositeID_a: 'String',
      withCompositeID_b: 'String',
      withCompositeID: FindUniqueRelationsWithCompositeID,
      withCompositeUnique_a: 'String',
      withCompositeUnique_b: 'String',
      withCompositeUnique: FindUniqueRelationsWithCompositeUnique,
    }),
  });
export const FindUniqueRelationsUniqueFilter = builder.prismaWhereUnique('FindUniqueRelations', {
  name: 'FindUniqueRelationsUniqueFilter',
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
export const WithIDFindUniqueRelations = builder.prismaCreateRelation(
  'WithID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithID,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithIDCreate: InputObjectRef<Prisma.Prisma.WithIDCreateInput> = builder.prismaCreate(
  'WithID',
  {
    name: 'WithIDCreate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithIDFindUniqueRelations,
    }),
  },
);
export const WithIDUpdate: InputObjectRef<Prisma.Prisma.WithIDUpdateInput> = builder.prismaUpdate(
  'WithID',
  {
    name: 'WithIDUpdate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithIDFindUniqueRelations,
    }),
  },
);
export const WithIDCreateWithoutFindUniqueRelations: InputObjectRef<Prisma.Prisma.WithIDCreateWithoutFindUniqueRelationsInput> =
  builder.prismaCreate('WithID', {
    name: 'WithIDCreateWithoutFindUniqueRelations',
    fields: () => ({
      id: 'String',
    }),
  });
export const FindUniqueRelationsWithID = builder.prismaCreateRelation(
  'FindUniqueRelations',
  'withID',
  {
    fields: () => ({
      create: WithIDCreateWithoutFindUniqueRelations,
      connect: WithIDUniqueFilter,
    }),
  },
);
export const FindUniqueRelationsCreateWithoutWithUnique: InputObjectRef<Prisma.Prisma.FindUniqueRelationsCreateWithoutWithUniqueInput> =
  builder.prismaCreate('FindUniqueRelations', {
    name: 'FindUniqueRelationsCreateWithoutWithUnique',
    fields: () => ({
      id: 'String',
      withID_id: 'String',
      withID: FindUniqueRelationsWithID,
      withCompositeID_a: 'String',
      withCompositeID_b: 'String',
      withCompositeID: FindUniqueRelationsWithCompositeID,
      withCompositeUnique_a: 'String',
      withCompositeUnique_b: 'String',
      withCompositeUnique: FindUniqueRelationsWithCompositeUnique,
    }),
  });
export const WithUniqueFindUniqueRelations = builder.prismaCreateRelation(
  'WithUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithUnique,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithUniqueCreate: InputObjectRef<Prisma.Prisma.WithUniqueCreateInput> =
  builder.prismaCreate('WithUnique', {
    name: 'WithUniqueCreate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithUniqueFindUniqueRelations,
    }),
  });
export const WithUniqueUpdate: InputObjectRef<Prisma.Prisma.WithUniqueUpdateInput> =
  builder.prismaUpdate('WithUnique', {
    name: 'WithUniqueUpdate',
    fields: () => ({
      id: 'String',
      FindUniqueRelations: WithUniqueFindUniqueRelations,
    }),
  });
export const FindUniqueRelationsCreateWithoutWithCompositeID: InputObjectRef<Prisma.Prisma.FindUniqueRelationsCreateWithoutWithCompositeIDInput> =
  builder.prismaCreate('FindUniqueRelations', {
    name: 'FindUniqueRelationsCreateWithoutWithCompositeID',
    fields: () => ({
      id: 'String',
      withID_id: 'String',
      withID: FindUniqueRelationsWithID,
      withUnique_id: 'String',
      withUnique: FindUniqueRelationsWithUnique,
      withCompositeUnique_a: 'String',
      withCompositeUnique_b: 'String',
      withCompositeUnique: FindUniqueRelationsWithCompositeUnique,
    }),
  });
export const WithCompositeIDFindUniqueRelations = builder.prismaCreateRelation(
  'WithCompositeID',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeID,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithCompositeIDCreate: InputObjectRef<Prisma.Prisma.WithCompositeIDCreateInput> =
  builder.prismaCreate('WithCompositeID', {
    name: 'WithCompositeIDCreate',
    fields: () => ({
      a: 'String',
      b: 'String',
      FindUniqueRelations: WithCompositeIDFindUniqueRelations,
    }),
  });
export const WithCompositeIDUpdate: InputObjectRef<Prisma.Prisma.WithCompositeIDUpdateInput> =
  builder.prismaUpdate('WithCompositeID', {
    name: 'WithCompositeIDUpdate',
    fields: () => ({
      a: 'String',
      b: 'String',
      FindUniqueRelations: WithCompositeIDFindUniqueRelations,
    }),
  });
export const FindUniqueRelationsCreateWithoutWithCompositeUnique: InputObjectRef<Prisma.Prisma.FindUniqueRelationsCreateWithoutWithCompositeUniqueInput> =
  builder.prismaCreate('FindUniqueRelations', {
    name: 'FindUniqueRelationsCreateWithoutWithCompositeUnique',
    fields: () => ({
      id: 'String',
      withID_id: 'String',
      withID: FindUniqueRelationsWithID,
      withUnique_id: 'String',
      withUnique: FindUniqueRelationsWithUnique,
      withCompositeID_a: 'String',
      withCompositeID_b: 'String',
      withCompositeID: FindUniqueRelationsWithCompositeID,
    }),
  });
export const WithCompositeUniqueFindUniqueRelations = builder.prismaCreateRelation(
  'WithCompositeUnique',
  'FindUniqueRelations',
  {
    fields: () => ({
      create: FindUniqueRelationsCreateWithoutWithCompositeUnique,
      connect: FindUniqueRelationsUniqueFilter,
    }),
  },
);
export const WithCompositeUniqueCreate: InputObjectRef<Prisma.Prisma.WithCompositeUniqueCreateInput> =
  builder.prismaCreate('WithCompositeUnique', {
    name: 'WithCompositeUniqueCreate',
    fields: () => ({
      a: 'String',
      c: 'String',
      b: 'String',
      FindUniqueRelations: WithCompositeUniqueFindUniqueRelations,
    }),
  });
export const WithCompositeUniqueUpdate: InputObjectRef<Prisma.Prisma.WithCompositeUniqueUpdateInput> =
  builder.prismaUpdate('WithCompositeUnique', {
    name: 'WithCompositeUniqueUpdate',
    fields: () => ({
      a: 'String',
      c: 'String',
      b: 'String',
      FindUniqueRelations: WithCompositeUniqueFindUniqueRelations,
    }),
  });
export const FindUniqueRelationsCreate: InputObjectRef<Prisma.Prisma.FindUniqueRelationsCreateInput> =
  builder.prismaCreate('FindUniqueRelations', {
    name: 'FindUniqueRelationsCreate',
    fields: () => ({
      id: 'String',
      withID_id: 'String',
      withID: FindUniqueRelationsWithID,
      withUnique_id: 'String',
      withUnique: FindUniqueRelationsWithUnique,
      withCompositeID_a: 'String',
      withCompositeID_b: 'String',
      withCompositeID: FindUniqueRelationsWithCompositeID,
      withCompositeUnique_a: 'String',
      withCompositeUnique_b: 'String',
      withCompositeUnique: FindUniqueRelationsWithCompositeUnique,
    }),
  });
export const FindUniqueRelationsUpdate: InputObjectRef<Prisma.Prisma.FindUniqueRelationsUpdateInput> =
  builder.prismaUpdate('FindUniqueRelations', {
    name: 'FindUniqueRelationsUpdate',
    fields: () => ({
      id: 'String',
      withID_id: 'String',
      withID: FindUniqueRelationsWithID,
      withUnique_id: 'String',
      withUnique: FindUniqueRelationsWithUnique,
      withCompositeID_a: 'String',
      withCompositeID_b: 'String',
      withCompositeID: FindUniqueRelationsWithCompositeID,
      withCompositeUnique_a: 'String',
      withCompositeUnique_b: 'String',
      withCompositeUnique: FindUniqueRelationsWithCompositeUnique,
    }),
  });
