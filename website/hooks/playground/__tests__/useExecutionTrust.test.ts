import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  effects: [] as Array<() => (() => void) | undefined>,
  state: undefined as unknown,
  readInitial: vi.fn<() => unknown>(),
}));
vi.mock('react', () => ({
  useRef: (initial: unknown) => ({ current: initial }),
  useState: (initial: unknown) => {
    harness.state = initial;
    return [
      initial,
      (next: unknown) => {
        harness.state = next;
      },
    ];
  },
  useEffect: (effect: () => (() => void) | undefined) => {
    harness.effects.push(effect);
  },
}));
vi.mock('../useUrlSync', () => ({ readInitialFromURL: harness.readInitial }));

import { useExecutionTrust } from '../useExecutionTrust';

beforeEach(() => {
  harness.effects = [];
  harness.readInitial.mockReset();
  vi.stubGlobal('window', {
    location: { reload: vi.fn() },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('shared code trust boundary', () => {
  it('stays blocked when StrictMode replays effects after URL sync clears the hash', () => {
    harness.readInitial.mockReturnValue({ files: [{ content: 'untrusted()' }] });
    const trust = useExecutionTrust();
    expect(trust.executionAllowed).toBe(false);
    const cleanup = harness.effects[0]();
    expect(trust.executionAllowedRef.current).toBe(false);
    cleanup?.();
    // This reproduces the first URL-sync effect clearing the initial hash.
    harness.readInitial.mockReturnValue(null);
    harness.effects[0]();
    expect(harness.readInitial).toHaveBeenCalledTimes(1);
    expect(harness.state).toBe(false);
    expect(trust.executionAllowedRef.current).toBe(false);
    trust.allowExecution();
    expect(harness.state).toBe(true);
    expect(trust.executionAllowedRef.current).toBe(true);
  });

  it('allows a fresh default sketch but revokes permission on hash navigation', () => {
    harness.readInitial.mockReturnValue(null);
    const trust = useExecutionTrust();
    harness.effects[0]();
    expect(trust.executionAllowedRef.current).toBe(true);
    const navigate = vi.mocked(window.addEventListener).mock.calls[0][1] as () => void;
    navigate();
    expect(trust.executionAllowedRef.current).toBe(false);
    expect(harness.state).toBe(false);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });
});
