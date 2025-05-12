import { faker } from '@faker-js/faker';
import { Injectable } from '@nestjs/common';
import { User } from './user.model';

@Injectable()
export class UserRepository {
  private users = new Map<string, User>();

  constructor() {
    this.seed();
  }

  getUserById(userId: string): User | null {
    return this.users.get(userId) ?? null;
  }

  private seed() {
    for (let i = 1; i <= 100; i += 1) {
      this.users.set(String(i), {
        id: String(i),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      });
    }
  }
}
