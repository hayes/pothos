import { Customer } from './types';

export const customers: Customer[] = Array.from({ length: 10 })
  .fill(0)
  .map((_, index) => ({ id: index + 1, age: getAge(index), displayName: `User_${index}` }));

function getAge(index: number): number {
  return 100 - index * 10;
}
