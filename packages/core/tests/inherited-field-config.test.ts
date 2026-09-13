import { type GraphQLFieldResolver, type GraphQLObjectType, graphql } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '../src';

const pluginName = 'inheritedFieldConfigTest' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;
const fields: PothosOutputFieldConfig<SchemaTypes>[] = [];
const args: PothosInputFieldConfig<SchemaTypes>[] = [];

class OwnerPlugin extends BasePlugin<SchemaTypes> {
  override onOutputFieldConfig(config: PothosOutputFieldConfig<SchemaTypes>) {
    fields.push(config);
    return { ...config, description: `${config.parentType}.${config.name}` };
  }

  override onInputFieldConfig(config: PothosInputFieldConfig<SchemaTypes>) {
    args.push(config);
    return config;
  }

  override wrapResolve(
    resolve: GraphQLFieldResolver<unknown, object, object>,
    config: PothosOutputFieldConfig<SchemaTypes>,
  ) {
    if (config.name !== 'owner') {
      return resolve;
    }
    return () => config.parentType;
  }
}

SchemaBuilder.registerPlugin(pluginName, OwnerPlugin as never);

it('builds inherited field and argument configs for each owner through a diamond', async () => {
  fields.length = 0;
  args.length = 0;
  const builder = new SchemaBuilder({ plugins: [pluginName] });
  const base = builder.interfaceRef<{ value: string }>('Base').implement({
    fields: (t) => ({
      owner: t.string({
        exampleRequiredOptionFromPlugin: true,
        args: { input: t.arg.string() },
        resolve: () => 'original',
      }),
      value: t.string({ resolve: undefined, exampleRequiredOptionFromPlugin: true }),
    }),
  });
  const left = builder.interfaceRef<{ value: string }>('Left').implement({ interfaces: [base] });
  const right = builder.interfaceRef<{ value: string }>('Right').implement({ interfaces: [base] });
  const first = builder.objectRef<{ value: string }>('First').implement({
    interfaces: [left, right, base],
  });
  const second = builder.objectRef<{ value: string }>('Second').implement({ interfaces: [base] });
  builder.queryType({
    fields: (t) => ({
      first: t.field({ type: first, resolve: () => ({ value: 'one' }) }),
      second: t.field({ type: second, resolve: () => ({ value: 'two' }) }),
    }),
  });

  for (let build = 0; build < 2; build += 1) {
    fields.length = 0;
    args.length = 0;
    const schema = builder.toSchema();
    const result = await graphql({
      schema,
      source: '{ first { owner value } second { owner value } }',
    });
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      first: { owner: 'First', value: 'one' },
      second: { owner: 'Second', value: 'two' },
    });
    for (const name of ['Base', 'Left', 'Right', 'First', 'Second']) {
      const configs = fields.filter((field) => field.parentType === name && field.name === 'owner');
      expect(configs).toHaveLength(1);
      expect(configs[0].declaringType).toBe(name === 'Base' ? undefined : 'Base');
      expect(args.filter((arg) => arg.parentType === name && arg.name === 'input')).toHaveLength(1);
      const value = (schema.getType(name) as GraphQLObjectType).getFields().value;
      expect(value.description).toBe(`${name}.value`);
      expect(value.resolve).toBeUndefined();
      expect(value.extensions.pothosResolveWrapped).toBe(false);
    }
    expect(new Set(fields.filter((field) => field.name === 'owner')).size).toBe(5);
  }
});

it('keeps interface and object override precedence when owner-specific hooks filter fields', () => {
  const filterPlugin = 'inheritedFieldFilterTest' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;
  class FilterPlugin extends BasePlugin<SchemaTypes> {
    override onOutputFieldConfig(config: PothosOutputFieldConfig<SchemaTypes>) {
      if (config.description === 'filtered') {
        return null;
      }
      return config;
    }
  }
  SchemaBuilder.registerPlugin(filterPlugin, FilterPlugin as never);
  const builder = new SchemaBuilder({ plugins: [filterPlugin] });
  const base = builder.interfaceRef<{}>('Original').implement({
    fields: (t) => ({
      value: t.string({
        description: 'base',
        resolve: () => 'base',
        exampleRequiredOptionFromPlugin: true,
      }),
    }),
  });
  const middle = builder.interfaceRef<{}>('Override').implement({
    interfaces: [base],
    fields: (t) => ({
      value: t.string({
        description: 'middle',
        resolve: () => 'middle',
        exampleRequiredOptionFromPlugin: true,
      }),
    }),
  });
  const filtered = builder.interfaceRef<{}>('Filtered').implement({
    interfaces: [middle, base],
    fields: (t) => ({
      value: t.string({
        description: 'filtered',
        resolve: () => 'filtered',
        exampleRequiredOptionFromPlugin: true,
      }),
    }),
  });
  const object = builder.objectRef<{}>('Own').implement({
    interfaces: [filtered, middle, base],
    fields: (t) => ({
      value: t.string({ description: 'object', resolve: () => 'object' }),
    }),
  });
  builder.queryType({
    fields: (t) => ({ object: t.field({ type: object, resolve: () => ({}) }) }),
  });
  const schema = builder.toSchema();
  expect((schema.getType('Original') as GraphQLObjectType).getFields().value.description).toBe(
    'base',
  );
  expect((schema.getType('Override') as GraphQLObjectType).getFields().value.description).toBe(
    'middle',
  );
  expect((schema.getType('Filtered') as GraphQLObjectType).getFields().value.description).toBe(
    'base',
  );
  const own = (schema.getType('Own') as GraphQLObjectType).getFields().value;
  expect(own.description).toBe('object');
  expect(own.extensions.pothosConfig).not.toHaveProperty('declaringType');
});
