import { resolveArrayConnection } from '../src';

describe('resolveArrayConnection', () => {
  it('caps backward pages from the end of the requested window', () => {
    const result = resolveArrayConnection({ args: { last: 3 }, maxSize: 2 }, [0, 1, 2, 3, 4]);

    expect(result.edges.map((edge) => edge?.node)).toEqual([3, 4]);
  });
});
