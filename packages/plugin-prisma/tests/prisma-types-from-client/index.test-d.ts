import { describe, expectTypeOf, it } from 'vitest';
import type { PrismaTypesFromClient } from '../../src';
import { PrismaClient } from './client';
import type PrismaTypes from './generated';

describe('PrismaTypesFromClient', () => {
  // Type-only test, no actual database connection needed
  const db = null as unknown as PrismaClient;
  const prismaTypes = {} as unknown as PrismaTypes;
  const prismaTypesFromClient = {} as unknown as PrismaTypesFromClient<typeof db, false>;

  it('PrismaTypes and PrismaTypesFromClient are equal', () => {
    expectTypeOf(prismaTypes).toMatchTypeOf<typeof prismaTypesFromClient>();
  });

  it('PrismaTypesFromClient and PrismaClient are equal', () => {
    expectTypeOf(prismaTypesFromClient).toMatchTypeOf<typeof prismaTypes>();
  });

  it('User addresses is array', () => {
    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .toBeArray();
  });

  it('user.addresses[0].country?.capital?.name', () => {
    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .items.toHaveProperty('country')
      .toMatchTypeOf<{
        name: string;
        code: string;
        capital: {
          name: string;
        } | null;
      } | null>();
  });

  it('user.addresses[0].country.capital.name', () => {
    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .items.toHaveProperty('country')
      // @ts-expect-error Country nullable
      .toHaveProperty('capital')
      // @ts-expect-error Capital nullable
      .toHaveProperty('name')
      .toBeString();
  });

  it('user.addresses has street, city, zip', () => {
    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .items.toHaveProperty('street')
      .toBeString();

    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .items.toHaveProperty('city')
      .toBeString();

    expectTypeOf(prismaTypesFromClient.User)
      .toHaveProperty('Shape')
      .toHaveProperty('addresses')
      .items.toHaveProperty('zip')
      .toBeString();
  });
});
