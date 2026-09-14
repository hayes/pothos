import SchemaBuilder from '@pothos/core';
import { print } from 'graphql';
import DirectivesPlugin from '../src';

it.each([
  false,
  true,
])('keeps shared directive options unchanged when synthesizing deprecations (frozen: %s)', (frozen) => {
  const directives = [{ name: 'tag' as const, args: { value: 'shared' } }];
  if (frozen) {
    Object.freeze(directives);
  }
  const builder = new SchemaBuilder<{
    Directives: {
      tag: { locations: 'FIELD_DEFINITION'; args: { value: string } };
    };
  }>({ plugins: [DirectivesPlugin] });
  builder.queryType({
    fields: (t) => ({
      old: t.string({ directives, deprecationReason: 'use current', resolve: () => 'old' }),
      current: t.string({ directives, resolve: () => 'current' }),
    }),
  });

  for (let build = 0; build < 2; build += 1) {
    const fields = builder.toSchema().getQueryType()!.getFields();
    expect(print(fields.old.astNode!)).toBe(
      'old: String @deprecated(reason: "use current") @tag(value: "shared")',
    );
    expect(print(fields.current.astNode!)).toBe('current: String @tag(value: "shared")');
    expect(fields.current.extensions.directives).toEqual([
      { name: 'tag', args: { value: 'shared' } },
    ]);
    expect(directives).toEqual([{ name: 'tag', args: { value: 'shared' } }]);
  }
});

it('keeps an explicitly shared deprecation directive unchanged when overriding one field', () => {
  const directives = [{ name: 'deprecated' as const, args: { reason: 'shared reason' } }];
  const builder = new SchemaBuilder<{
    Directives: {
      deprecated: { locations: 'FIELD_DEFINITION'; args: { reason: string } };
    };
  }>({ plugins: [DirectivesPlugin] });
  builder.queryType({
    fields: (t) => ({
      overridden: t.string({ directives, deprecationReason: 'local reason', resolve: () => '' }),
      unchanged: t.string({ directives, resolve: () => '' }),
    }),
  });

  const fields = builder.toSchema().getQueryType()!.getFields();
  expect(print(fields.overridden.astNode!)).toBe(
    'overridden: String @deprecated(reason: "local reason")',
  );
  expect(print(fields.unchanged.astNode!)).toBe(
    'unchanged: String @deprecated(reason: "shared reason")',
  );
  expect(directives).toEqual([{ name: 'deprecated', args: { reason: 'shared reason' } }]);
});
