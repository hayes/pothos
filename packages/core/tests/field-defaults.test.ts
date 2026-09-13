import { defaultFieldResolver, type GraphQLObjectType, graphql } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ObjectFieldBuilder,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  QueryFieldBuilder,
  type SchemaTypes,
} from '../src';

const pluginName = 'fieldDefaultsTest' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;
const seen: PothosOutputFieldConfig<SchemaTypes>[] = [];
class DefaultsPlugin extends BasePlugin<SchemaTypes> {
  override onOutputFieldConfig(config: PothosOutputFieldConfig<SchemaTypes>) {
    seen.push(config);
    return config.name === 'hidden' ? null : config;
  }
  override onInputFieldConfig(config: PothosInputFieldConfig<SchemaTypes>) {
    return config.name === 'omit' ? null : config;
  }
}
SchemaBuilder.registerPlugin(pluginName, DefaultsPlugin as never);

it('builds default fields through normal hooks without replacing filtered local fields', async () => {
  const builder = new SchemaBuilder({ plugins: [pluginName] });
  const object = builder.objectRef<{ value: string }>('Example').implement({
    fields: (t) => ({ hidden: t.int({ description: 'local', resolve: () => 42 }) }),
  });
  builder.configStore.addFieldDefaults(object, () => {
    const t = new ObjectFieldBuilder(builder);
    return {
      value: t.string({
        resolve: defaultFieldResolver as never,
        args: { keep: t.arg.string(), omit: t.arg.string() },
      }),
      hidden: t.string({ resolve: () => 'default' }),
    };
  });
  builder.queryType({
    fields: (t) => ({ obj: t.field({ type: object, resolve: () => ({ value: 'value' }) }) }),
  });
  for (let build = 0; build < 2; build += 1) {
    seen.length = 0;
    const schema = builder.toSchema();
    const fields = (schema.getType('Example') as GraphQLObjectType).getFields();
    expect(Object.keys(fields)).toEqual(['value']);
    expect(fields.value.args.map((arg) => arg.name)).toEqual(['keep']);
    expect(fields.value.resolve).toBeUndefined();
    expect(fields.value.extensions.pothosResolveWrapped).toBe(false);
    expect(seen.filter((config) => config.parentType === 'Example')).toHaveLength(2);
    expect(seen.find((config) => config.name === 'hidden')?.description).toBe('local');
    expect(await graphql({ schema, source: '{ obj { value } }' })).toEqual({
      data: { obj: { value: 'value' } },
    });
  }
  expect(() => builder.objectField(object, 'hidden', (t) => t.int({ resolve: () => 43 }))).toThrow(
    'Duplicate field hidden',
  );
});

it('retries failed default initialization without registering duplicate local fields', async () => {
  const builder = new SchemaBuilder({});
  const ref = builder.queryType({});
  const t = new QueryFieldBuilder(builder);
  let fail = true;
  builder.configStore.addFieldDefaults(ref, () => ({
    [fail ? 'stale' : 'first']: t.int({ resolve: () => 1 }),
  }));
  builder.configStore.addFieldDefaults(ref, () => {
    if (fail) {
      throw new Error('initialization failed');
    }
    return { second: t.int({ resolve: () => 2 }) };
  });
  expect(() => builder.toSchema()).toThrow('initialization failed');
  fail = false;
  for (let build = 0; build < 2; build += 1) {
    const schema = builder.toSchema();
    expect(schema.getQueryType()!.getFields().stale).toBeUndefined();
    expect(await graphql({ schema, source: '{ first second }' })).toEqual({
      data: { first: 1, second: 2 },
    });
  }
});
