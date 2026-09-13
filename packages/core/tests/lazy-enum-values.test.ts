import { graphql, versionInfo } from 'graphql';
import SchemaBuilder, { BasePlugin, type PothosTypeConfig, type SchemaTypes } from '../src';

class LazyEnumPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(config: PothosTypeConfig): PothosTypeConfig {
    if (config.kind !== 'Enum') {
      return config;
    }
    const values = config.values;
    return {
      ...config,
      values: () => (typeof values === 'function' ? values() : values),
    };
  }
}

declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      lazyEnumReview: LazyEnumPlugin<Types>;
    }
  }
}

SchemaBuilder.registerPlugin('lazyEnumReview', LazyEnumPlugin);

it.skipIf(versionInfo.major < 17)('executes enum values supplied lazily by a plugin', async () => {
  const builder = new SchemaBuilder({ plugins: ['lazyEnumReview'] });
  const Choice = builder.enumType('Choice', {
    values: { FIRST: { value: 1 }, SECOND: { value: 2 } },
  });
  builder.queryType({
    fields: (t) => ({
      choice: t.field({
        type: Choice,
        args: { choice: t.arg({ type: Choice, required: true }) },
        resolve: (_, { choice }) => choice,
      }),
    }),
  });

  expect(
    await graphql({ schema: builder.toSchema(), source: '{ choice(choice: SECOND) }' }),
  ).toEqual({
    data: { choice: 'SECOND' },
  });
});
