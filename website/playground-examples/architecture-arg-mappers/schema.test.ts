import { readFileSync } from 'node:fs';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import { type GraphQLFieldResolver, graphql, parse, subscribe } from 'graphql';
import { describe, expect, it } from 'vitest';
import { pluginName } from './plugin';
import { schema } from './schema';

declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      argMapperProbe: ProbePlugin<Types>;
    }
  }
}

// The probe observes real Pothos composition, rather than invoking hooks by hand.
const events: string[] = [];
class ProbePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(config: PothosOutputFieldConfig<Types>) {
    if (!config.extensions?.normalizeName) {
      return config;
    }
    return {
      ...config,
      argMappers: [
        ...config.argMappers,
        (args: Record<string, unknown>) => {
          events.push(`mapped:${args.name}`);
          return args;
        },
      ],
    };
  }

  override wrapArgMappers(
    next: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    config: PothosOutputFieldConfig<Types>,
  ) {
    if (!next || !config.extensions?.normalizeName) {
      return next;
    }
    return async (
      parent: unknown,
      args: object,
      context: Types['Context'],
      info: Parameters<NonNullable<typeof next>>[3],
    ) => {
      events.push(`outer:${(args as Record<string, unknown>).name}`);
      try {
        return await next(parent, args, context, info);
      } catch (error) {
        events.push('outer-error');
        throw error;
      }
    };
  }

  override wrapResolve(
    next: GraphQLFieldResolver<unknown, Types['Context'], object>,
    config: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (!config.extensions?.normalizeName) {
      return next;
    }
    return async (parent, args, context, info) => {
      events.push(`resolve:${(args as Record<string, unknown>).name}`);
      try {
        return await next(parent, args, context, info);
      } catch (error) {
        events.push('resolve-error');
        throw error;
      }
    };
  }

  override wrapSubscribe(
    next: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    config: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    if (!next || !config.extensions?.normalizeName) {
      return next;
    }
    return (parent, args, context, info) => {
      events.push(`subscribe:${(args as Record<string, unknown>).name}`);
      return next(parent, args, context, info);
    };
  }
}
SchemaBuilder.registerPlugin('argMapperProbe', ProbePlugin);

function observedSchema() {
  const builder = new SchemaBuilder({ plugins: ['argMapperProbe', pluginName] });
  builder.queryType({
    fields: (t) => ({
      greeting: t.string({
        extensions: { normalizeName: true },
        args: { name: t.arg.string({ required: true }) },
        resolve: (_parent, { name }) => {
          events.push(`application:${name}`);
          if (name === 'broken') {
            throw new Error('Application failure');
          }
          return name;
        },
      }),
    }),
  });
  builder.subscriptionType({
    fields: (t) => ({
      greeting: t.string({
        extensions: { normalizeName: true },
        args: { name: t.arg.string({ required: true }) },
        subscribe: async function* (_parent, { name }) {
          events.push(`stream:${name}`);
          yield name;
        },
        resolve: (value, { name }) => {
          events.push(`event:${name}`);
          return String(value);
        },
      }),
    }),
  });
  return builder.toSchema();
}

const observed = observedSchema();

describe('argument mapper guide', () => {
  const expected = JSON.parse(readFileSync(new URL('./expected.json', import.meta.url), 'utf8'));
  it.each(Object.keys(expected))('matches the authored operation %s', async (file) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const result = await graphql({ schema, source });
    const json = JSON.parse(JSON.stringify(result));
    if (json.errors) {
      json.errors = json.errors.map(
        ({ locations: _locations, ...error }: { locations: unknown }) => error,
      );
    }
    expect(json).toEqual(expected[file]);
  });

  it('orders outer wrappers, sequential mappers, inner wrappers, and application', async () => {
    events.length = 0;
    expect(await graphql({ schema: observed, source: '{ greeting(name: " Gina ") }' })).toEqual({
      data: { greeting: 'Gina' },
    });
    expect(events).toEqual(['outer: Gina ', 'mapped:Gina', 'resolve:Gina', 'application:Gina']);
  });

  it.each([
    ' ',
    ' reserved ',
  ])('handles mapper failure before the resolver wrappers: %j', async (name) => {
    events.length = 0;
    const result = await graphql({
      schema: observed,
      source: `{ greeting(name: ${JSON.stringify(name)}) }`,
    });
    expect(result.errors?.[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(events).toEqual([`outer:${name}`, 'outer-error']);
  });

  it('retains application errors, which can also reach the outer boundary', async () => {
    events.length = 0;
    const result = await graphql({ schema: observed, source: '{ greeting(name: "broken") }' });
    expect(result.errors?.[0].message).toBe('Application failure');
    expect(result.errors?.[0].extensions.code).toBeUndefined();
    expect(events).toEqual([
      'outer:broken',
      'mapped:broken',
      'resolve:broken',
      'application:broken',
      'resolve-error',
      'outer-error',
    ]);
  });

  it('preserves absent subscribe functions', () => {
    expect(observed.getQueryType()!.getFields().greeting.subscribe).toBeUndefined();
  });

  it('maps subscription setup and the subsequent event resolver separately', async () => {
    events.length = 0;
    const result = await subscribe({
      schema: observed,
      document: parse('subscription { greeting(name: " Gina ") }'),
    });
    if (!('next' in result)) {
      throw new Error(JSON.stringify(result));
    }
    expect(events).toEqual(['outer: Gina ', 'mapped:Gina', 'subscribe:Gina']);
    expect((await result.next()).value).toEqual({ data: { greeting: 'Gina' } });
    expect(events).toEqual([
      'outer: Gina ',
      'mapped:Gina',
      'subscribe:Gina',
      'stream:Gina',
      'outer: Gina ',
      'mapped:Gina',
      'resolve:Gina',
      'event:Gina',
    ]);
    await result.return?.();
  });

  it.each([
    ' ',
    ' reserved ',
  ])('handles subscription mapper errors before setup: %j', async (name) => {
    events.length = 0;
    const result = await subscribe({
      schema: observed,
      document: parse(`subscription { greeting(name: ${JSON.stringify(name)}) }`),
    });
    if ('next' in result) {
      await result.return?.();
      throw new Error('Invalid input must not start the subscription');
    }
    expect(result.errors?.[0].extensions.code).toBe('BAD_USER_INPUT');
    expect(events).toEqual([`outer:${name}`, 'outer-error']);
  });
});
