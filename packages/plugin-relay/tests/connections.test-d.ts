import { expectTypeOf, it } from 'vitest';
import { resolveCursorConnection } from '../src';

it('types a cursor resolver that cannot return null as a non-null connection', async () => {
  const result = await resolveCursorConnection(
    { args: { first: 1 }, toCursor: (row) => row.id },
    () => [{ id: '1' }],
  );

  expectTypeOf(result).not.toBeNullable();
  expectTypeOf(result.edges[0]?.node).toEqualTypeOf<{ id: string }>();
});

it('types a cursor resolver that can return null as a nullable connection', async () => {
  const result = await resolveCursorConnection(
    { args: { first: 1 }, toCursor: (row) => row.id },
    (): { id: string }[] | null => null,
  );

  expectTypeOf(result).toBeNullable();

  // @ts-expect-error `result` may be null at runtime, so it has to be guarded first.
  const unguarded: unknown = result.edges;

  expectTypeOf(unguarded).toBeUnknown();

  if (result) {
    expectTypeOf(result.edges[0]?.node).toEqualTypeOf<{ id: string }>();
  }
});

it('types an async cursor resolver that can return null as a nullable connection', async () => {
  const result = await resolveCursorConnection(
    { args: { first: 1 }, toCursor: (row) => row.id },
    async (): Promise<{ id: string }[] | null> => null,
  );

  expectTypeOf(result).toBeNullable();

  // @ts-expect-error `result` may be null at runtime, so it has to be guarded first.
  const unguarded: unknown = result.edges;

  expectTypeOf(unguarded).toBeUnknown();
});

it('preserves nullable items from the cursor resolver result', async () => {
  const result = await resolveCursorConnection(
    { args: { first: 1 }, toCursor: (row) => String(row?.id) },
    () => [{ id: '1' }, null] as ({ id: string } | null)[],
  );

  expectTypeOf(result).not.toBeNullable();
  expectTypeOf(result.edges[0]?.node).toEqualTypeOf<{ id: string } | null>();
});
