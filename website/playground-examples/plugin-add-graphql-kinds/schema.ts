// #region types
import SchemaBuilder from '@pothos/core';
import AddGraphQLPlugin from '@pothos/plugin-add-graphql';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql';

type MemberShape = { name: string };
type FilterShape = { name?: string | null };

const ExistingNamed = new GraphQLInterfaceType({
  name: 'Named',
  fields: { name: { type: GraphQLString } },
  resolveType: () => 'Member',
});
const ExistingMember = new GraphQLObjectType<MemberShape>({
  name: 'Member',
  interfaces: [ExistingNamed],
  fields: { name: { type: GraphQLString } },
});
const ExistingSearchResult = new GraphQLUnionType({
  name: 'SearchResult',
  types: [ExistingMember],
  resolveType: () => 'Member',
});
const ExistingOrder = new GraphQLEnumType({
  name: 'Order',
  values: { ASC: { value: 'asc' }, DESC: { value: 'desc' } },
});
const ExistingFilter = new GraphQLInputObjectType({
  name: 'MemberFilter',
  fields: { name: { type: GraphQLString } },
});

const builder = new SchemaBuilder({ plugins: [AddGraphQLPlugin] });
const Named = builder.addGraphQLInterface<MemberShape>(ExistingNamed);
const SearchResult = builder.addGraphQLUnion<MemberShape>(ExistingSearchResult);
const Order = builder.addGraphQLEnum<'asc' | 'desc'>(ExistingOrder);
const MemberFilter = builder.addGraphQLInput<FilterShape>(ExistingFilter);

const members: MemberShape[] = [{ name: 'Leia' }, { name: 'Luke' }];
builder.queryType({
  fields: (t) => ({
    member: t.field({ type: Named, resolve: () => members[0] }),
    search: t.field({
      type: [SearchResult],
      args: {
        filter: t.arg({ type: MemberFilter }),
        order: t.arg({ type: Order }),
      },
      resolve: (_parent, { filter, order }) => {
        const matches = members.filter((member) => !filter?.name || member.name === filter.name);
        return order === 'desc' ? matches.reverse() : matches;
      },
    }),
  }),
});
// #endregion types
export const schema = builder.toSchema();
