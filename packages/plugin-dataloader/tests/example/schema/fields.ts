import builder from '../builder';
import { IPost } from '../types';
import { countCall, postCounts, postsCounts, postSortedCounts, postsSortedCounts } from './counts';

const Post = builder.objectRef<IPost>('Post').implement({
  fields: (t) => ({
    id: t.exposeID('id', {}),
    title: t.exposeString('title', {}),
    content: t.exposeString('title', {}),
  }),
});

builder.queryFields((t) => ({
  post: t.loadable({
    type: Post,
    nullable: true,
    args: {
      id: t.arg.int({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postCounts, ids.length);

      return Promise.resolve(
        ids.map((id) =>
          id > 0
            ? { id, title: `${id} title`, content: `${id} content` }
            : new Error(`Invalid ID ${id}`),
        ),
      );
    },
    resolve: (_root, args) => Promise.resolve(args.id),
  }),
  posts: t.loadable({
    type: [Post],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.intList({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postsCounts, ids.length);

      return Promise.resolve(
        ids.map((id) =>
          id > 0
            ? { id, title: `${id} title`, content: `${id} content` }
            : new Error(`Invalid ID ${id}`),
        ),
      );
    },
    resolve: (_root, args) => Promise.resolve(args.ids),
  }),
  postSorted: t.loadable({
    type: Post,
    nullable: true,
    args: {
      id: t.arg.int({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postSortedCounts, ids.length);

      return Promise.resolve(
        ids.map((id) => ({ id, title: `${id} title`, content: `${id} content` })).reverse(),
      );
    },
    sort: (post) => post.id,
    resolve: (_root, args) => Promise.resolve(args.id),
  }),
  postsSorted: t.loadable({
    type: [Post],
    nullable: {
      list: true,
      items: true,
    },
    args: {
      ids: t.arg.intList({
        required: true,
      }),
    },
    load: (ids: number[], context) => {
      countCall(context, postsSortedCounts, ids.length);

      return Promise.resolve(
        ids.map((id) => ({ id, title: `${id} title`, content: `${id} content` })).reverse(),
      );
    },
    sort: (post) => post.id,
    resolve: (_root, args) => Promise.resolve(args.ids),
  }),
  postNullable: t.loadable({
    type: Post,
    nullable: true,
    load: (ids: number[], context) =>
      Promise.resolve(ids.map((id) => ({ id, title: `${id} title`, content: `${id} content` }))),
    resolve: (_root, args) => null,
  }),
  postsNullable: t.loadable({
    type: [Post],
    nullable: {
      list: false,
      items: true,
    },
    load: (ids: number[], context) =>
      Promise.resolve(ids.map((id) => ({ id, title: `${id} title`, content: `${id} content` }))),
    resolve: (_root, args) => [null],
  }),

  oneToMany: t.loadableList({
    type: Post,
    nullable: {
      list: true,
      items: true,
    },
    args: {
      id: t.arg.id({
        required: true,
      }),
    },
    load: (ids: number[]) =>
      Promise.resolve(
        ids.map((idRange) =>
          idRange % 2
            ? [idRange * 10 + 1, idRange * 10 + 2, idRange * 10 + 3, null].map((id) =>
                id === null
                  ? null
                  : {
                      id,
                      title: `${id} title`,
                      content: `${id} content`,
                    },
              )
            : null,
        ),
      ),
    resolve: (_root, args) => Number.parseInt(String(args.id), 10),
  }),
}));
