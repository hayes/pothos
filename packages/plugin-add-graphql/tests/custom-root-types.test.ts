import SchemaBuilder from '@pothos/core';
import { buildSchema, execute, parse, printSchema, validateSchema } from 'graphql';
import AddGraphQLPlugin from '../src';

describe('importing schemas with custom operation root names', () => {
  it('keeps the operation root roles of the imported schema', async () => {
    const existingSchema = buildSchema(`
      schema {
        query: Root
        mutation: RootMutation
      }

      type Root {
        hello: String
      }

      type RootMutation {
        setHello(value: String): String
      }
    `);

    const rootType = existingSchema.getQueryType()!;
    rootType.getFields().hello.resolve = () => 'world';

    const builder = new SchemaBuilder({
      plugins: [AddGraphQLPlugin],
      add: { schema: existingSchema },
    });

    const schema = builder.toSchema();

    expect(validateSchema(schema)).toStrictEqual([]);
    expect(schema.getQueryType()?.name).toBe('Root');
    expect(schema.getMutationType()?.name).toBe('RootMutation');
    expect(printSchema(schema)).toContain('schema {\n  query: Root\n  mutation: RootMutation\n}');

    const result = await execute({ schema, document: parse('{ hello }') });

    expect(result.data).toEqual({ hello: 'world' });
  });
});
