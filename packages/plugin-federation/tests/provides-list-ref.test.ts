import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import { graphql } from 'graphql';
import FederationPlugin from '../src';

it('publishes provides selections through array, ListRef, and nested ListRef fields', async () => {
  const builder = new SchemaBuilder({ plugins: [DirectivesPlugin, FederationPlugin] });
  const User = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
    externalFields: (t) => ({ id: t.id(), name: t.string() }),
  });
  const ProvidedUser = User.provides<{ name: string }>('name');
  const user = { id: '1', name: 'Ada' };
  builder.queryType({
    fields: (t) => ({
      array: t.field({ type: [ProvidedUser], resolve: () => [user] }),
      list: t.field({ type: t.listRef(ProvidedUser), resolve: () => [user] }),
      nested: t.field({ type: t.listRef(t.listRef(ProvidedUser)), resolve: () => [[user]] }),
    }),
  });

  for (let build = 0; build < 2; build += 1) {
    const schema = builder.toSubGraphSchema({});
    const result = await graphql({ schema, source: '{ _service { sdl } }' });
    expect(result.errors).toBeUndefined();
    const sdl = (result.data!._service as { sdl: string }).sdl;
    expect(sdl).toContain('array: [User!] @provides(fields: "name")');
    expect(sdl).toContain('list: [User!] @provides(fields: "name")');
    expect(sdl).toContain('nested: [[User!]!] @provides(fields: "name")');
    expect(
      await graphql({ schema, source: '{ array { name } list { name } nested { name } }' }),
    ).toEqual({
      data: { array: [{ name: 'Ada' }], list: [{ name: 'Ada' }], nested: [[{ name: 'Ada' }]] },
    });
  }
});
