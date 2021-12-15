/* eslint-disable @typescript-eslint/no-parameter-properties */
/* eslint-disable max-classes-per-file */
/* eslint-disable no-magic-numbers */
import faker from 'faker';

faker.seed(123);

export class User {
  firstName;
  lastName;

  constructor(public id: string) {
    this.firstName = faker.name.firstName();
    this.lastName = faker.name.lastName();
  }
}

export class Post {
  authorId;
  title;
  content;

  constructor(public id: string) {
    this.authorId = String(faker.datatype.number({ min: 1, max: 100 }));
    this.title = faker.lorem.text();
    this.content = faker.lorem.paragraphs(2);
  }
}

export class Comment {
  postId;
  authorId;
  comment;
  constructor(public id: string) {
    this.authorId = String(faker.datatype.number({ min: 1, max: 100 }));
    this.postId = String(faker.datatype.number({ min: 1, max: 100 }));
    this.comment = faker.lorem.text();
  }
}

export const Users = new Map<string, User>();
export const Posts = new Map<string, Post>();
export const Comments = new Map<string, Comment>();

// Create 100 users, posts and comments
for (let i = 1; i <= 100; i += 1) {
  Users.set(String(i), new User(String(i)));
  Posts.set(String(i), new Post(String(i)));
  Comments.set(String(i), new Comment(String(i)));
}
