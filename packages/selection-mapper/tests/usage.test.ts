import { describe, expect, it } from 'vitest';
import { extendWithUsage, isUsed, wrapWithUsageCheck } from '../src';

describe('usage check', () => {
  it('reports a query as used once any key is read', () => {
    const query = wrapWithUsageCheck({ select: { id: true } });

    expect(isUsed(query)).toBe(false);
    expect(query.select).toEqual({ id: true });
    expect(isUsed(query)).toBe(true);
  });

  it('treats an empty query and an unwrapped object as used', () => {
    expect(isUsed(wrapWithUsageCheck({}))).toBe(true);
    expect(isUsed({ select: {} })).toBe(true);
  });

  it('keeps tracking through extendWithUsage', () => {
    const query = wrapWithUsageCheck({ select: { id: true } });
    const extended = extendWithUsage(query, { where: { id: 1 } });

    expect(isUsed(extended)).toBe(false);
    expect(extended.where).toEqual({ id: 1 });
    expect(isUsed(extended)).toBe(false);
    expect(extended.select).toEqual({ id: true });
    expect(isUsed(extended)).toBe(true);
    expect(Object.keys(extended)).toEqual(['where', 'select']);
  });
});
