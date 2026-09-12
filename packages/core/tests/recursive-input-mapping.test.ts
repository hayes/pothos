import { execute, type GraphQLFieldResolver } from 'graphql';
import gql from 'graphql-tag';
import SchemaBuilder, {
  BasePlugin,
  createInputValueMapper,
  mapInputFields,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '../src';

const pluginName =
  'recursiveInputMappingTestPlugin' as keyof PothosSchemaTypes.Plugins<SchemaTypes>;

class UppercaseLeafPlugin extends BasePlugin<SchemaTypes> {
  override wrapResolve(
    resolve: GraphQLFieldResolver<unknown, object, object>,
    fieldConfig: PothosOutputFieldConfig<SchemaTypes>,
  ): GraphQLFieldResolver<unknown, object, object> {
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (field) =>
      field.name === 'leaf' ? true : null,
    );

    if (!argMappings) {
      return resolve;
    }

    const mapArgs = createInputValueMapper(argMappings, (value) =>
      typeof value === 'string' ? value.toUpperCase() : value,
    );

    return (parent, args, context, info) => resolve(parent, mapArgs(args) as object, context, info);
  }
}

SchemaBuilder.registerPlugin(pluginName, UppercaseLeafPlugin as never);

interface AInput {
  b?: BInput | null;
  leaf?: string | null;
}

interface BInput {
  a?: AInput | null;
}

function recursiveSchema() {
  const builder = new SchemaBuilder({ plugins: [pluginName] });
  const a = builder.inputRef<AInput>('A');
  const b = builder.inputRef<BInput>('B');

  a.implement({
    fields: (t) => ({
      b: t.field({ type: b, required: false }),
      leaf: t.string({ required: false }),
    }),
  });

  b.implement({
    fields: (t) => ({
      a: t.field({ type: a, required: false }),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      value: t.string({
        args: { input: t.arg({ type: a, required: true }) },
        resolve: (_parent, args) => JSON.stringify(args.input),
      }),
    }),
  });

  return builder.toSchema();
}

describe('mapInputFields with mutually recursive input types', () => {
  it('maps a leaf reached directly', async () => {
    const result = await execute({
      schema: recursiveSchema(),
      document: gql`
        query {
          value(input: { leaf: "direct" })
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(JSON.parse(result.data!.value as string)).toEqual({ leaf: 'DIRECT' });
  });

  it('maps a leaf reached through a cycle', async () => {
    const result = await execute({
      schema: recursiveSchema(),
      document: gql`
        query {
          value(input: { b: { a: { leaf: "nested" } } })
        }
      `,
    });

    expect(result.errors).toBeUndefined();
    expect(JSON.parse(result.data!.value as string)).toEqual({
      b: { a: { leaf: 'NESTED' } },
    });
  });
});
