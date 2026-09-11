import { afterEach, expect, it, vi } from 'vitest';
import { captureConsole, captureConsoleAsync } from '../console-capture';

afterEach(() => vi.restoreAllMocks());

it('restores console when overlapping captures finish in start order', async () => {
  const original = vi.spyOn(console, 'log').mockImplementation(() => {});
  let finishFirst!: () => void;
  let finishSecond!: () => void;
  const first = captureConsoleAsync(
    () =>
      new Promise<void>((resolve) => {
        finishFirst = resolve;
      }),
  );
  const second = captureConsoleAsync(
    () =>
      new Promise<void>((resolve) => {
        finishSecond = resolve;
      }),
  );
  console.log('second');
  finishFirst();
  const firstResult = await first;
  console.log('still second');
  finishSecond();
  const secondResult = await second;
  expect(console.log).toBe(original);
  console.log('outside');
  expect(firstResult.logs).toHaveLength(0);
  expect(secondResult.logs.map((log) => log.args)).toEqual([['second'], ['still second']]);
});

it('resumes an outer capture after a nested capture throws', async () => {
  const original = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const outer = await captureConsoleAsync(async () => {
    await Promise.resolve();
    expect(() =>
      captureConsole(() => {
        console.warn('inner');
        throw new Error('failed');
      }),
    ).toThrow('failed');
    console.warn('outer');
  });
  expect(console.warn).toBe(original);
  expect(outer.logs.map((log) => log.args)).toEqual([['outer']]);
});

it('retains logs supplied by callers when a synchronous capture throws', () => {
  const original = vi.spyOn(console, 'error').mockImplementation(() => {});
  const logs: Parameters<typeof captureConsole>[1] = [];
  expect(() =>
    captureConsole(() => {
      console.error('failure');
      throw new Error('failed');
    }, logs),
  ).toThrow('failed');
  expect(logs).toHaveLength(1);
  expect(console.error).toBe(original);
});
