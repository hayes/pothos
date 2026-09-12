import type { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  mapInputFields,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '../src';

const pluginName = 'removedArgsTestPlugin' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

class RemovingPlugin extends BasePlugin<SchemaTypes> {
  seenArgs: Record<string, unknown>[] = [];

  override onInputFieldConfig(field: PothosInputFieldConfig<SchemaTypes>) {
    return field.name === 'removed' ? null : field;
  }

  override wrapResolve(
    resolve: GraphQLFieldResolver<unknown, object, object>,
    config: PothosOutputFieldConfig<SchemaTypes>,
  ) {
    this.seenArgs.push(config.args);
    // A documented `mapInputFields` consumer: it dereferences every arg config.
    mapInputFields(config.args, this.buildCache, () => null);

    return resolve;
  }
}

SchemaBuilder.registerPlugin(pluginName, RemovingPlugin as never);

describe('arguments removed by onInputFieldConfig', () => {
  it('omits removed args from the config passed to resolver wrappers', () => {
    const builder = new SchemaBuilder({ plugins: [pluginName] });

    builder.queryType({
      fields: (t) => ({
        value: t.string({
          args: {
            removed: t.arg.string(),
            kept: t.arg.string(),
          },
          resolve: () => 'ok',
        }),
      }),
    });

    const schema = builder.toSchema();
    const field = schema.getQueryType()!.getFields().value;

    expect(field.args.map((arg) => arg.name)).toEqual(['kept']);

    const configArgs = (field.extensions as { pothosConfig: PothosOutputFieldConfig<SchemaTypes> })
      .pothosConfig.args;

    expect(Object.keys(configArgs)).toEqual(['kept']);
    expect(Object.values(configArgs)).not.toContain(null);
  });
});
