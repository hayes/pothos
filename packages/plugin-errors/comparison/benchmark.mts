import { performance } from 'node:perf_hooks';

const variants = {
  direct: '../src/subscription-iterator.ts',
  'direct-refined': './subscription-iterator.direct.ts',
  generator: './subscription-iterator.generator.ts',
  'sync-generator': './subscription-iterator.sync-generator.ts',
  'stream-generator': './subscription-iterator.stream-generator.ts',
};
const variant = process.argv[2] ?? 'direct';
if (!(variant in variants) || !globalThis.gc) {
  throw new Error('Run with --expose-gc and a known variant name');
}
const { wrapSubscriptionIterator } = (await import(
  new URL(variants[variant as keyof typeof variants], import.meta.url).href
)) as typeof import('../src/subscription-iterator');
const iterator = wrapSubscriptionIterator(
  {
    next: () => Promise.resolve({ value: 1, done: false }),
    return: () => Promise.resolve({ value: undefined, done: true }),
  },
  (error) => {
    throw error;
  },
);

// A synthetic sequential-read workload measures overhead, not pubsub throughput.
for (let i = 0; i < 20_000; i += 1) {
  await iterator.next();
}
const samples = [];
for (let sample = 0; sample < 3; sample += 1) {
  globalThis.gc();
  const heapBefore = process.memoryUsage().heapUsed;
  const start = performance.now();
  for (let i = 0; i < 100_000; i += 1) {
    await iterator.next();
  }
  const milliseconds = performance.now() - start;
  globalThis.gc();
  samples.push({ milliseconds, retainedBytes: process.memoryUsage().heapUsed - heapBefore });
}
await iterator.return!();
const times = samples.map((sample) => sample.milliseconds).sort((a, b) => a - b);
process.stdout.write(
  `${JSON.stringify({ variant, iterations: 100_000, medianMilliseconds: times[1], samples })}\n`,
);
