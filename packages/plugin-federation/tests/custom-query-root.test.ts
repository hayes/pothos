import { printSubgraphSchema } from '@apollo/subgraph';
import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import FederationPlugin from '../src';

function createBuilder() {
  return new SchemaBuilder({
    plugins: [DirectivesPlugin, FederationPlugin],
    directives: {
      useGraphQLToolsUnorderedDirectives: true,
    },
  });
}

describe('federation', () => {
  describe('custom query root name', () => {
    it('replaces the custom root instead of duplicating it', () => {
      const builder = createBuilder();

      const UserRef = builder.objectRef<{ id: string }>('User');

      UserRef.implement({
        fields: (t) => ({
          id: t.exposeString('id'),
        }),
      });

      builder.asEntity(UserRef, {
        key: builder.selection<{ id: string }>('id'),
        resolveReference: (user) => user,
      });

      builder.queryType({
        name: 'Root',
        fields: (t) => ({
          user: t.field({
            type: UserRef,
            resolve: () => ({ id: '1' }),
          }),
        }),
      });

      const schema = builder.toSubGraphSchema({});
      const queryType = schema.getQueryType()!;

      expect(queryType.name).toBe('Root');
      expect(schema.getType('Root')).toBe(queryType);
      expect(Object.keys(queryType.getFields())).toEqual(
        expect.arrayContaining(['_entities', '_service', 'user']),
      );

      expect(printSubgraphSchema(schema)).toContain('type Root');
    });

    it('still replaces a conventional Query root', () => {
      const builder = createBuilder();

      builder.queryType({
        fields: (t) => ({
          hello: t.string({ resolve: () => 'world' }),
        }),
      });

      const schema = builder.toSubGraphSchema({});
      const queryType = schema.getQueryType()!;

      expect(queryType.name).toBe('Query');
      expect(schema.getType('Query')).toBe(queryType);
      expect(Object.keys(queryType.getFields())).toEqual(
        expect.arrayContaining(['_service', 'hello']),
      );
    });
  });
});
