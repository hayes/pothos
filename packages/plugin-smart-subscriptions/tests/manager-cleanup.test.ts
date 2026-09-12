import { SubscriptionManager } from '../src';

describe('SubscriptionManager cleanup', () => {
  it('unsubscribes from every name when one unsubscribe rejects', async () => {
    const cleaned: string[] = [];

    const manager = new SubscriptionManager({
      value: {},
      subscribe: () => {},
      unsubscribe: (name) => {
        cleaned.push(name);

        return name === 'first' ? Promise.reject(new Error('cleanup failed')) : Promise.resolve();
      },
    });

    manager.register({ name: 'first' });
    manager.register({ name: 'second' });

    await expect(manager.return()).rejects.toThrow('cleanup failed');
    expect(cleaned).toEqual(['first', 'second']);
  });

  it('surfaces every error when multiple unsubscribes reject', async () => {
    const cleaned: string[] = [];

    const manager = new SubscriptionManager({
      value: {},
      subscribe: () => {},
      unsubscribe: (name) => {
        cleaned.push(name);

        return Promise.reject(new Error(`${name} failed`));
      },
    });

    manager.register({ name: 'first' });
    manager.register({ name: 'second' });

    const error = await manager.return().then(
      () => null,
      (err: unknown) => err as AggregateError,
    );

    expect(cleaned).toEqual(['first', 'second']);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error!.errors as Error[]).map((err) => err.message)).toEqual([
      'first failed',
      'second failed',
    ]);
  });
});
