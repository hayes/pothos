export interface PageCursor {
  cursor: string;
  pageNumber: number;
  isCurrent: boolean;
}

export interface PageCursors {
  first: PageCursor;
  around: PageCursor[];
  last: PageCursor;
}

export interface IUser {
  __typename: 'User';
  id: string;
  firstName: string;
  lastName: string;
}

export interface IPost {
  __typename: 'Post';
  id: string;
  authorId: string;
  title: string;
  content: string;
}

export interface IComment {
  __typename: 'Comment';
  id: string;
  postId: string;
  authorId: string;
  comment: string;
}
