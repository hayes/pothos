import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import { graphql } from 'graphql';
import FederationPlugin from '../src';

it.each([
  'Query',
  'Root',
])('retains references to the %s root throughout the output graph', async (name) => {
  const builder = new SchemaBuilder({ plugins: [DirectivesPlugin, FederationPlugin] });
  const Root = builder.queryType({
    name,
    fields: (t) => ({ hello: t.string({ resolve: () => 'hello' }) }),
  });
  const Container = builder.interfaceRef<{}>('Container').implement({
    fields: (t) => ({ root: t.field({ type: Root, resolve: () => ({}) }) }),
  });
  const Box = builder.objectRef<{}>('Box').implement({ interfaces: [Container] });
  const Result = builder.unionType('Result', { types: [Root, Box], resolveType: () => Root });
  builder.queryFields((t) => ({
    self: t.field({ type: Root, resolve: () => ({}) }),
    wrapped: t.field({
      type: [Root],
      nullable: { list: false, items: false },
      resolve: () => [{}],
    }),
    box: t.field({ type: Box, resolve: () => ({}) }),
    result: t.field({ type: Result, resolve: () => ({}) }),
  }));
  builder.mutationType({ fields: (t) => ({ root: t.field({ type: Root, resolve: () => ({}) }) }) });
  const ordinarySchema = builder.toSchema();

  for (let build = 0; build < 2; build++) {
    const schema = builder.toSubGraphSchema({});
    expect(
      await graphql({
        schema,
        source: `{ self { hello } wrapped { hello } box { root { hello } } result { ... on ${name} { hello } } }`,
      }),
    ).toEqual({
      data: {
        self: { hello: 'hello' },
        wrapped: [{ hello: 'hello' }],
        box: { root: { hello: 'hello' } },
        result: { hello: 'hello' },
      },
    });
    expect(await graphql({ schema, source: 'mutation { root { hello } }' })).toEqual({
      data: { root: { hello: 'hello' } },
    });
    const service = await graphql({ schema, source: '{ self { _service { sdl } } }' });
    expect(service.errors).toBeUndefined();
    expect(service.data?.self).toHaveProperty('_service.sdl');
  }
  expect(ordinarySchema.getQueryType()!.getFields()).not.toHaveProperty('_service');
});
