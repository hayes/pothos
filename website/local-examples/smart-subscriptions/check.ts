import assert from 'node:assert/strict';
import { parse, subscribe } from 'graphql';
import { type Context, events, schema, vote } from './schema';

async function main() {
  const document = parse('subscription { polls { id question votes } }');
  const firstContext: Context = { listeners: new Map() };
  const secondContext: Context = { listeners: new Map() };
  const first = await subscribe({ schema, document, contextValue: firstContext });
  const second = await subscribe({ schema, document, contextValue: secondContext });
  assert(Symbol.asyncIterator in first, 'Expected a subscription iterator');
  assert(Symbol.asyncIterator in second, 'Expected a second subscription iterator');
  const a = first[Symbol.asyncIterator]();
  const b = second[Symbol.asyncIterator]();
  const initial = { data: { polls: [{ id: '1', question: 'Tea or coffee?', votes: 0 }] } };
  const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
  try {
    assert.deepEqual(plain((await a.next()).value), initial);
    assert.deepEqual(plain((await b.next()).value), initial);
    assert.equal(events.listenerCount('poll/1'), 2);
    const firstUpdate = a.next();
    const secondUpdate = b.next();
    vote('1');
    const updated = { data: { polls: [{ id: '1', question: 'Tea or coffee?', votes: 1 }] } };
    assert.deepEqual(plain((await firstUpdate).value), updated);
    assert.deepEqual(plain((await secondUpdate).value), updated);
    await a.return?.();
    assert.equal(firstContext.listeners.size, 0);
    assert.equal(events.listenerCount('poll/1'), 1, 'Other operation must retain its listener');
    const remainingUpdate = b.next();
    vote('1');
    assert.deepEqual(plain((await remainingUpdate).value), {
      data: { polls: [{ id: '1', question: 'Tea or coffee?', votes: 2 }] },
    });
    console.log('PASS initial results, event updates, and independent subscription cleanup');
  } finally {
    await a.return?.();
    await b.return?.();
  }
  assert.equal(secondContext.listeners.size, 0);
  assert.equal(events.eventNames().length, 0, 'All event listeners must be removed');
}

const timeout = setTimeout(() => {
  console.error('Subscription example timed out waiting for a result or cleanup');
  process.exit(1);
}, 10000);
main()
  .finally(() => clearTimeout(timeout))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
