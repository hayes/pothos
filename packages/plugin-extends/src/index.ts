import { BasePlugin, ObjectType, BuildCache } from '@giraphql/core';
import { GraphQLObjectType } from 'graphql';
import './global-types';

export default class ExtendsPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  visitObjectType(
    type: ObjectType<{}, any[], Types, any>,
    built: GraphQLObjectType,
    cache: BuildCache<Types>,
  ) {
    // const fieldsByType: {
    //   [K in keyof Types['Output']]?: FieldsShape<{ [s: string]: unknown }, Types, K, {}>;
    // } = type.options.extends || {};
    // const typeNames = Object.keys(fieldsByType) as NamedTypeParam<Types>[];
    // for (const name of typeNames) {
    //   const fields = fieldsByType[name] || {};
    //   const { type, built } = store.getEntryOfType(name, 'Object');
    // }
  }
}
