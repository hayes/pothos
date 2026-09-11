import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileTypeScriptInWorker, terminateWorker } from '../compiler-worker-client';

class MockWorker {
  static instances: MockWorker[] = [];
  listeners = new Map<string, (event: { data?: unknown }) => void>();
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    MockWorker.instances.push(this);
  }
  addEventListener(type: string, callback: (event: { data?: unknown }) => void) {
    this.listeners.set(type, callback);
  }
  emit(type: string, data?: unknown) {
    this.listeners.get(type)?.({ data });
  }
}

describe('compiler worker lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('Worker', MockWorker);
    MockWorker.instances = [];
  });
  afterEach(() => {
    terminateWorker();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects every queued compilation when one request times out', async () => {
    const first = compileTypeScriptInWorker('first').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(1000);
    const second = compileTypeScriptInWorker('second').catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(14000);
    expect(await first).toEqual(new Error('Compile timed out after 15000ms'));
    expect(await second).toEqual(new Error('Compile timed out after 15000ms'));
    expect(MockWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('terminates errored workers and ignores their late events after replacement', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = compileTypeScriptInWorker('first').catch((error: Error) => error);
    const oldWorker = MockWorker.instances[0];
    oldWorker.emit('error');
    expect(await first).toEqual(new Error('Worker error'));
    expect(oldWorker.terminate).toHaveBeenCalledOnce();
    const second = compileTypeScriptInWorker('second');
    const replacement = MockWorker.instances[1];
    oldWorker.emit('error');
    expect(replacement.terminate).not.toHaveBeenCalled();
    const request = replacement.postMessage.mock.calls[0][0] as { id: string };
    replacement.emit('message', { type: 'success', id: request.id, code: 'compiled' });
    expect(await second).toEqual({ success: true, code: 'compiled' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
