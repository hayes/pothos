import { typeBrandKey } from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { rebrandForVariant } from '../src/utils/branding';

describe('rebrandForVariant — Object.create wrap invariant', () => {
  it('two sibling variants leave the parent brand untouched', () => {
    // Order-of-resolution test — sibling t.variant fields resolve in
    // unspecified order. Neither branding should mutate the parent.
    const parent = { id: 1, role: 'admin' };
    const adminWrapper = rebrandForVariant(parent, 'AdminUser') as Record<symbol, unknown>;
    const basicWrapper = rebrandForVariant(parent, 'BasicUser') as Record<symbol, unknown>;
    expect(adminWrapper).not.toBe(parent);
    expect(basicWrapper).not.toBe(parent);
    expect(adminWrapper[typeBrandKey]).toBe('AdminUser');
    expect(basicWrapper[typeBrandKey]).toBe('BasicUser');
    expect((parent as Record<symbol, unknown>)[typeBrandKey]).toBeUndefined();
  });

  it('property access on the wrapper inherits from the parent', () => {
    const parent = { id: 7, posts: [{ title: 'a' }] };
    const wrapper = rebrandForVariant(parent, 'Admin') as Record<string, unknown>;
    expect(wrapper.id).toBe(7);
    expect(wrapper.posts).toBe(parent.posts);
  });

  it('returns the parent unchanged if already branded with the same variant', () => {
    // Recursive variant chains through the same type — don't keep
    // stacking wrappers.
    const parent = { id: 1 };
    const first = rebrandForVariant(parent, 'X') as Record<symbol, unknown>;
    const second = rebrandForVariant(first, 'X');
    expect(second).toBe(first);
  });
});
