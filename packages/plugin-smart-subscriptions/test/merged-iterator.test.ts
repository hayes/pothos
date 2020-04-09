import { MergedAsyncIterator } from '../src';

function testIterator(
  results: unknown[],
  {
    errorAfter = null,
    delayAll = false,
    delayN = null,
    delay = 0,
  }: {
    errorAfter?: number | null;
    delay?: number;
    delayN?: number | null;
    delayAll?: boolean;
  } = {},
): AsyncIterator<unknown> & { nextCalls: number; throwCalls: number; returnCalls: number } {
  let offset = 0;
  return {
    nextCalls: 0,
    throwCalls: 0,
    returnCalls: 0,
    next() {
      this.nextCalls += 1;

      if (errorAfter !== null && offset >= errorAfter) {
        return Promise.reject(new Error(`Rejected after ${errorAfter} results`));
      }

      if (delayAll || delayN === offset) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              value: results[offset],
              done: results.length <= (offset += 1),
            });
          }, delay);
        });
      }
      const result = Promise.resolve({
        value: results[offset],
        done: results.length <= (offset += 1),
      });

      return result;
    },

    throw(error: unknown) {
      this.throwCalls += 1;
      return Promise.reject(error);
    },

    return(val: unknown) {
      this.returnCalls += 1;
      return Promise.resolve({
        value: val,
        done: true as const,
      });
    },
  };
}

describe('MergedAsyncIterator', () => {
  test('Simple example', async () => {
    const merged = new MergedAsyncIterator([testIterator([1, 2]), testIterator(['a', 'b', 'c'])]);

    const expectedResults = [1, 'a', 2, 'b', 'c'];
    const results: unknown[] = [];

    for await (const value of merged) {
      results.push(value);
    }

    expect(results).toEqual(expectedResults);
  });

  test('Next calls are lazy', async () => {
    const numbers = testIterator([1, 2]);
    const letters = testIterator(['a', 'b', 'c']);

    const merged = new MergedAsyncIterator([numbers, letters]);

    const expectedResults = [1, 'a', 2, 'b', 'c'];
    const results: unknown[] = [];

    const iter = merged[Symbol.asyncIterator]();

    expect(numbers.nextCalls).toEqual(0);
    expect(letters.nextCalls).toEqual(0);

    let nextP = iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);

    results.push((await nextP).value);

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);

    nextP = iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);

    results.push((await nextP).value);

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);

    nextP = iter.next();

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(2);

    results.push((await nextP).value);

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(2);

    nextP = iter.next();

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(2);

    results.push((await nextP).value);

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(2);

    nextP = iter.next();

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(3);

    results.push((await nextP).value);

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(3);

    nextP = iter.next();

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(3);

    expect(await nextP).toEqual({ value: undefined, done: true });

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(3);

    expect(results).toEqual(expectedResults);
  });

  test('delays', async () => {
    const numbers = testIterator([1, 2], { delayN: 0, delay: 2 });
    const letters = testIterator(['a', 'b', 'c'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters]);

    const expectedResults = ['a', 1, 2, 'b', 'c'];
    const results: unknown[] = [];

    const iter = merged[Symbol.asyncIterator]();

    results.push((await iter.next()).value, (await iter.next()).value);

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(2);

    expect(results).toEqual(['a', 1]);

    results.push((await iter.next()).value);

    expect(results).toEqual(['a', 1, 2]);

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(2);

    results.push((await iter.next()).value);
    results.push((await iter.next()).value);

    expect(numbers.nextCalls).toEqual(2);
    expect(letters.nextCalls).toEqual(3);

    expect(results).toEqual(expectedResults);
  });

  test('Early return', async () => {
    const numbers = testIterator([1, 2]);
    const letters = testIterator(['a', 'b', 'c']);

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    await iter.next();
    await iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    const returnP = iter.return();

    expect(numbers.returnCalls).toEqual(1);
    expect(letters.returnCalls).toEqual(1);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    expect(await returnP).toEqual({
      value: undefined,
      done: true,
    });
  });

  test('return while pending', async () => {
    const numbers = testIterator([1, 2], { delayAll: true, delay: 1 });
    const letters = testIterator(['a', 'b', 'c'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    const nextP = iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    const returnP = iter.return();

    expect(numbers.returnCalls).toEqual(1);
    expect(letters.returnCalls).toEqual(1);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    expect(await nextP).toEqual({
      value: undefined,
      done: true,
    });

    expect(await returnP).toEqual({
      value: undefined,
      done: true,
    });
  });

  test('return when partially done', async () => {
    const numbers = testIterator([1]);
    const letters = testIterator(['a', 'b', 'c'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    await iter.next();
    await iter.next();

    const nextP = iter.next();
    const returnP = iter.return();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(2);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(1);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    expect(await nextP).toEqual({
      value: undefined,
      done: true,
    });

    expect(await returnP).toEqual({
      value: undefined,
      done: true,
    });
  });

  test('throw', async () => {
    const numbers = testIterator([1, 2]);
    const letters = testIterator(['a', 'b', 'c']);

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    await iter.next();
    await iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    const throwP = iter.throw(new Error('Hi'));

    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(1);
    expect(letters.throwCalls).toEqual(1);

    await expect(throwP).rejects.toMatchObject({ message: 'Hi' });
  });

  test('throw while pending', async () => {
    const numbers = testIterator([1, 2], { delayAll: true, delay: 1 });
    const letters = testIterator(['a', 'b', 'c'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    const nextP = iter.next();

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(1);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(0);

    const throwP = iter.throw(new Error('Hi'));

    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(1);
    expect(letters.throwCalls).toEqual(1);

    expect(await nextP).toEqual({
      value: undefined,
      done: true,
    });

    await expect(throwP).rejects.toMatchObject({ message: 'Hi' });
  });

  test('throw when partially done', async () => {
    const numbers = testIterator([1]);
    const letters = testIterator(['a', 'b', 'c'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters]);

    const iter = merged[Symbol.asyncIterator]();

    await iter.next();
    await iter.next();

    const nextP = iter.next();
    const throwP = iter.throw(new Error('Hi'));

    expect(numbers.nextCalls).toEqual(1);
    expect(letters.nextCalls).toEqual(2);
    expect(numbers.returnCalls).toEqual(0);
    expect(letters.returnCalls).toEqual(0);
    expect(numbers.throwCalls).toEqual(0);
    expect(letters.throwCalls).toEqual(1);

    expect(await nextP).toEqual({
      value: undefined,
      done: true,
    });

    await expect(throwP).rejects.toMatchObject({ message: 'Hi' });
  });

  test('debounce', async () => {
    const numbers = testIterator([1, 2, 3, 4, 5, 6], { delayAll: true, delay: 1 });
    const letters = testIterator(['a', 'b', 'c', 'd'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters], {
      debounce: 10,
    });

    const expectedResults = [
      1, // First result always comes through
      'a', // already pulled, but delayed by debounce
      'b', // 3rd call to next calls next on numbers and letters, they both resolve before the
      // debounce so we only get the last to arrive (letter)
      'c',
      'd',
      5,
      6,
    ];
    const results: unknown[] = [];

    for await (const value of merged) {
      results.push(value);
    }

    expect(results).toEqual(expectedResults);
  });

  test('debounce with slower iterators', async () => {
    const numbers = testIterator([1, 2, 3, 4, 5, 6], { delayAll: true, delay: 10 });
    const letters = testIterator(['a', 'b', 'c', 'd'], { delayAll: true, delay: 10 });

    const merged = new MergedAsyncIterator([numbers, letters], {
      debounce: 1,
    });

    // No results lost in debounce when results are delayed
    const expectedResults = [1, 'a', 2, 'b', 3, 'c', 4, 'd', 5, 6];
    const results: unknown[] = [];

    for await (const value of merged) {
      results.push(value);
    }

    expect(results).toEqual(expectedResults);
  });

  test('debounce first', async () => {
    const numbers = testIterator([1, 2, 3, 4, 5, 6], { delayAll: true, delay: 1 });
    const letters = testIterator(['a', 'b', 'c', 'd'], { delayAll: true, delay: 1 });

    const merged = new MergedAsyncIterator([numbers, letters], {
      debounce: 10,
      debounceFirst: true,
    });

    const expectedResults = [
      'a', // debounce first results so we get the last result of pulling the first number and letter
      'b', // 3rd call to next calls next on numbers and letters, they both resolve before the
      // debounce so we only get the last to arrive (letter)
      'c',
      'd',
      5,
      6,
    ];
    const results: unknown[] = [];

    for await (const value of merged) {
      results.push(value);
    }

    expect(results).toEqual(expectedResults);
  });
});
