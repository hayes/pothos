import {
  offsetToCursor,
  resolveArrayConnection,
  resolveCursorConnection,
  resolveOffsetConnection,
} from '../src';

describe('resolveArrayConnection', () => {
  it('caps backward pages from the end of the requested window', () => {
    const result = resolveArrayConnection({ args: { last: 3 }, maxSize: 2 }, [0, 1, 2, 3, 4]);

    expect(result.edges.map((edge) => edge?.node)).toEqual([3, 4]);
  });

  it('returns an empty page when a stale after cursor is past the end of the array', () => {
    // Offset 4 was a valid cursor before the collection shrank to two rows.
    const result = resolveArrayConnection({ args: { after: offsetToCursor(4), first: 2 } }, [0, 1]);

    expect(result.edges).toEqual([]);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });
});

describe('resolveOffsetConnection', () => {
  it('never requests a negative limit when a stale after cursor is past totalCount', async () => {
    let requested: { offset: number; limit: number } | undefined;

    const result = await resolveOffsetConnection(
      { args: { after: offsetToCursor(4), first: 2 }, totalCount: 2 },
      (params) => {
        requested = params;

        return [];
      },
    );

    expect(requested?.limit).toBeGreaterThanOrEqual(0);
    expect(result.edges).toEqual([]);
    expect(result.pageInfo.hasNextPage).toBe(false);
  });

  it('returns null when the resolver returns null', async () => {
    const result = await resolveOffsetConnection(
      { args: { first: 1 } },
      (): { id: string }[] | null => null,
    );

    expect(result).toBeNull();
    // Reading `edges` without guarding throws, so the return type has to stay nullable.
    expect(() => result!.edges).toThrow(TypeError);
  });
});

describe('resolveCursorConnection', () => {
  it('infers the node type from a readonly array of rows', async () => {
    const rows: readonly { id: string }[] = [{ id: '1' }, { id: '2' }];

    const result = await resolveCursorConnection(
      { args: { first: 1 }, toCursor: (row) => row.id },
      () => rows,
    );

    expect(result.edges.map((edge) => edge?.node.id)).toEqual(['1']);
  });

  it('returns null when the resolver returns null', async () => {
    const result = await resolveCursorConnection(
      { args: { first: 1 }, toCursor: (row) => row.id },
      (): { id: string }[] | null => null,
    );

    expect(result).toBeNull();
    // Reading `edges` without guarding throws, so the return type has to stay nullable.
    expect(() => result!.edges).toThrow(TypeError);
  });
});
