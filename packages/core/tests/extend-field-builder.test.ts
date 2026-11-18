import type { GraphQLObjectType } from 'graphql';
import SchemaBuilder, { extendFieldBuilder, fieldBuilderCloneKey } from '../src';

it('extendFieldBuilder stacks, survives cloning and leaves the parent unchanged', () => {
  const builder = new SchemaBuilder({});
  const tag = (name: string) => (options: Record<string, unknown>) => ({
    ...options,
    description: [options.description, name].filter(Boolean).join(' '),
  });

  builder.queryType({
    fields: (t) => {
      const a = extendFieldBuilder(t, tag('a'));

      return {
        plain: t.string({ resolve: () => '' }),
        stacked: extendFieldBuilder(a, tag('b')).string({ resolve: () => '' }),
        cloned: a[fieldBuilderCloneKey]().string({ description: 'own', resolve: () => '' }),
      };
    },
  });

  const fields = (builder.toSchema().getType('Query') as GraphQLObjectType).getFields();

  expect(fields.plain.description).toBeUndefined();
  expect(fields.stacked.description).toBe('b a');
  expect(fields.cloned.description).toBe('own a');
});
