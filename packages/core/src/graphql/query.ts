// import { GraphQLObjectType } from 'graphql';
// // @ts-ignore
// import fromEntries from 'object.fromentries';
// import BaseType from './base';
// import BuildCache from '../build-cache';
// import { BasePlugin } from '../plugins';

// export default class QueryType extends BaseType {
//   kind: 'Query' = 'Query';

//   description?: string;

//   options: GiraphQLSchemaTypes.QueryTypeOptions;

//   constructor(options: GiraphQLSchemaTypes.QueryTypeOptions) {
//     super('Query');

//     this.options = options;
//   }

//   buildType(cache: BuildCache, plugin: Required<BasePlugin>): GraphQLObjectType {
//     return new GraphQLObjectType({
//       name: String(this.typename),
//       description: this.description,
//       fields: () =>
//         fromEntries(
//           Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
//             key,
//             field.build(key, cache, plugin),
//           ]),
//         ),
//       extensions: this.options.extensions,
//     });
//   }
// }
