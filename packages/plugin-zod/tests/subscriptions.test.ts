import SchemaBuilder from '@pothos/core';
import { type ExecutionResult, parse, subscribe } from 'graphql';
import * as zod from 'zod';
import ZodPlugin from '../src';

async function* once<T>(value: T) {
  yield await Promise.resolve(value);
}

async function run(schema: Parameters<typeof subscribe>[0]['schema'], source: string) {
  const result = await subscribe({ schema, document: parse(source), contextValue: {} });

  if (Symbol.asyncIterator in result) {
    const events: ExecutionResult[] = [];

    for await (const event of result) {
      events.push(event);
      break;
    }

    await result.return?.();

    return { events, errors: undefined };
  }

  return { events: [], errors: result.errors };
}

describe('subscriptions', () => {
  it('validates arguments before creating the source stream', async () => {
    const builder = new SchemaBuilder({ plugins: [ZodPlugin] });
    const observed: number[] = [];

    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.subscriptionType({
      fields: (t) => ({
        watch: t.int({
          args: { value: t.arg.int({ required: true, validate: { min: 1 } }) },
          subscribe: (_root, { value }) => {
            observed.push(value);

            return once(value);
          },
          resolve: (value: number) => value,
        }),
      }),
    });

    const { errors } = await run(builder.toSchema(), 'subscription { watch(value: -1) }');

    expect(observed).toEqual([]);
    expect(errors).toHaveLength(1);
  });

  it('applies a transform exactly once for subscribe and for resolve', async () => {
    const builder = new SchemaBuilder({ plugins: [ZodPlugin] });
    const subscribeArgs: string[] = [];
    const resolveArgs: string[] = [];

    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    builder.subscriptionType({
      fields: (t) => ({
        watch: t.string({
          args: {
            value: t.arg.string({
              required: true,
              validate: { schema: zod.string().transform((value) => `${value}!`) },
            }),
          },
          subscribe: (_root, { value }) => {
            subscribeArgs.push(value);

            return once(value);
          },
          resolve: (value: string, { value: arg }) => {
            resolveArgs.push(arg);

            return value;
          },
        }),
      }),
    });

    const { events, errors } = await run(builder.toSchema(), 'subscription { watch(value: "x") }');

    expect(errors).toBeUndefined();
    expect(subscribeArgs).toEqual(['x!']);
    expect(resolveArgs).toEqual(['x!']);
    expect(events[0]?.data).toEqual({ watch: 'x!' });
  });
});
