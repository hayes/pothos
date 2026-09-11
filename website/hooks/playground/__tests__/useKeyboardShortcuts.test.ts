import { afterEach, expect, it, vi } from 'vitest';

vi.mock('react', () => ({ useEffect: (effect: () => unknown) => effect() }));

import { useKeyboardShortcuts } from '../useKeyboardShortcuts';

afterEach(() => vi.unstubAllGlobals());

it('leaves Monaco shortcuts to the editor and handles shortcuts outside editors', () => {
  let listener!: (event: unknown) => void;
  vi.stubGlobal('window', {
    addEventListener: (_: string, handler: typeof listener) => {
      listener = handler;
    },
  });
  const activeElement = { matches: () => false, closest: vi.fn((): object | null => ({})) };
  vi.stubGlobal('document', { activeElement });
  const onRun = vi.fn();
  const preventDefault = vi.fn();
  useKeyboardShortcuts({ onRun });
  const event = { metaKey: true, key: 'Enter', preventDefault };
  listener(event);
  expect(onRun).not.toHaveBeenCalled();
  expect(preventDefault).not.toHaveBeenCalled();
  activeElement.closest.mockReturnValue(null);
  listener(event);
  expect(onRun).toHaveBeenCalledTimes(1);
  expect(preventDefault).toHaveBeenCalledTimes(1);
});
