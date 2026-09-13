import { printSubgraphSchema } from '@apollo/subgraph';
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../src';

it.each([
  false,
  true,
])('retains repeated extension directives with unordered output %s', (unordered) => {
  const builder = new SchemaBuilder({
    plugins: [DirectivesPlugin, FederationPlugin],
    directives: { useGraphQLToolsUnorderedDirectives: unordered },
  });
  builder.queryType({
    fields: (t) => ({
      hello: t.string({
        extensions: { directives: { tag: [{ name: 'first' }, { name: 'second' }] } },
        tag: 'third',
        resolve: () => 'hello',
      }),
    }),
  });

  const sdl = printSubgraphSchema(builder.toSubGraphSchema({}));
  expect(sdl).toContain(
    'hello: String @tag(name: "first") @tag(name: "second") @tag(name: "third")',
  );
});

it('retains a single unordered directive while adding federation directives', () => {
  const builder = new SchemaBuilder({ plugins: [DirectivesPlugin, FederationPlugin] });
  builder.queryType({
    fields: (t) => ({
      hello: t.string({
        extensions: { directives: { tag: { name: 'first' } } },
        tag: 'second',
        resolve: () => 'hello',
      }),
    }),
  });
  expect(printSubgraphSchema(builder.toSubGraphSchema({}))).toContain(
    'hello: String @tag(name: "first") @tag(name: "second")',
  );
});
