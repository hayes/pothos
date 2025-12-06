// Shared types used across the schema

export interface User {
  id: string;
  name: string;
  email: string;
  posts: Post[];
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  author?: User;
}

// Mock data store
export const users: User[] = [
  {
    id: '1',
    name: 'Alice',
    email: 'alice@example.com',
    posts: [],
  },
  {
    id: '2',
    name: 'Bob',
    email: 'bob@example.com',
    posts: [],
  },
];

export const posts: Post[] = [
  {
    id: '1',
    title: 'Hello Pothos',
    content: 'This is my first post about Pothos!',
    authorId: '1',
  },
  {
    id: '2',
    title: 'GraphQL is awesome',
    content: 'Building schemas with Pothos is a great experience.',
    authorId: '1',
  },
  {
    id: '3',
    title: 'Type safety rocks',
    content: 'Full type safety makes development so much better.',
    authorId: '2',
  },
];

// Link posts to users
users[0].posts = posts.filter((p) => p.authorId === '1');
users[1].posts = posts.filter((p) => p.authorId === '2');
posts.forEach((post) => {
  post.author = users.find((u) => u.id === post.authorId);
});
