import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import type { Post } from './post.model';

@Injectable()
export class PostRepository {
  private posts: Post[] = [];

  constructor() {
    this.seed();
  }

  getPosts(skip: number, take: number): Post[] {
    return this.posts.slice(skip, take + skip);
  }

  getPostById(postId: string): Post | null {
    return this.posts.find((post) => post.id === postId) || null;
  }

  getPostsByAuthorId(authorId: string): Post[] {
    return this.posts.filter((post) => post.authorId === authorId);
  }

  private seed() {
    for (let i = 1; i <= 100; i += 1) {
      this.posts.push({
        id: String(i),
        authorId: String(faker.number.int({ min: 1, max: 100 })),
        title: faker.lorem.text(),
        content: faker.lorem.paragraphs(2),
      });
    }
  }
}
