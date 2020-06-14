// import { GraphQLUnionType, GraphQLResolveInfo } from 'graphql';
// import BaseType from './base';
// import BuildCache from '../build-cache';
// import { ResolveValueWrapper, BasePlugin } from '../plugins';

// export default class UnionType extends BaseType {
//   kind: 'Union' = 'Union';

//   description?: string;

//   members: string[];

//   options: GiraphQLSchemaTypes.UnionOptions;

//   constructor(name: string, options: GiraphQLSchemaTypes.UnionOptions) {
//     super(name);

//     this.members = options.members;

//     this.description = options.description;

//     this.options = options;
//   }

//   resolveType = (parent: unknown, ctx: unknown, info: GraphQLResolveInfo) => {
//     const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;

//     return this.options.resolveType(obj, ctx, info);
//   };

//   buildType(cache: BuildCache, plugin: Required<BasePlugin>) {
//     return new GraphQLUnionType({
//       name: this.typename,
//       description: this.description,
//       resolveType: async (
//         parent: ResolveValueWrapper,
//         context: object,
//         info: GraphQLResolveInfo,
//       ) => {
//         const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;
//         const typename = await this.options.resolveType(obj, context, info);

//         await plugin.onUnionResolveType(typename, parent, context, info);

//         return typename;
//       },
//       types: () => this.members.map((member) => cache.getBuiltObject(member)),
//       extensions: this.options.extensions,
//     });
//   }
// }
