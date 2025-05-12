import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { Comment } from './comment.model';

@Injectable()
export class CommentRepository {
  private comments: Comment[] = [];

  constructor() {
    this.seed();
  }

  getCommentById(commentId: string): Comment | null {
    return this.comments.find((comment) => comment.id === commentId) || null;
  }

  getCommentsByPostId(postId: string): Comment[] {
    return this.comments.filter((comment) => comment.postId === postId);
  }

  getCommentsByAuthorId(authorId: string): Comment[] {
    return this.comments.filter((comment) => comment.authorId === authorId);
  }

  private seed() {
    for (let i = 1; i <= 100; i += 1) {
      this.comments.push({
        id: String(i),
        authorId: String(faker.number.int({ min: 1, max: 100 })),
        postId: String(faker.number.int({ min: 1, max: 100 })),
        comment: faker.lorem.text(),
      });
    }
  }
}
