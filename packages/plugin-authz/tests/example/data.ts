export enum Status {
  Public = 'public',
  Draft = 'draft',
}

export const users = [
  {
    id: '1',
    username: 'user01',
    email: 'user01@gmail.com',
    role: 'Customer',
  },
  {
    id: '2',
    username: 'user02',
    email: 'user02@gmail.com',
    role: 'Admin',
  },{
    id: '3',
    username: 'user03',
    email: 'user03@gmail.com',
    role: 'Customer',
  },
];

export const posts = [
  {
    id: '1',
    title: 'Post01 title',
    body: 'Post01 body',
    status: Status.Draft,
    authorId: '1',
  },
  {
    id: '2',
    title: 'Post02 title',
    body: 'Post02 body',
    status: Status.Public,
    authorId: '1',
  },
];
