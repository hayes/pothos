import type { User } from './types';

export const users: User[] = Array.from({ length: 10 })
  .fill(0)
  .map((_, index) => ({ id: index + 1, age: getAge(index) }));

function getAge(index: number): number {
  return 100 - index * 10;
}
