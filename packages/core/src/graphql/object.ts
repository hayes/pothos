// import { GraphQLObjectType } from 'graphql';
// // @ts-ignore
// import fromEntries from 'object.fromentries';
// import BaseType from './base';
// import BuildCache from '../build-cache';
// import { InterfaceType } from '..';
// import { BasePlugin } from '../plugins';

// export default class ObjectType extends BaseType {
//   kind: 'Object' = 'Object';

//   description?: string;

//   interfaces: string[];

//   options:
//     | GiraphQLSchemaTypes.ObjectTypeOptions<any, any>
//     | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<any, any, any>;

//   constructor(
//     name: string,
//     options:
//       | GiraphQLSchemaTypes.ObjectTypeOptions
//       | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions,
//   ) {
//     super(name);

//     if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
//       throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
//     }

//     this.options = options;

//     this.description = options.description;
//     this.interfaces = (options.implements ?? []).map((iface) =>
//       typeof iface === 'string' ? iface : (iface as InterfaceType).typename,
//     );
//   }

//   buildType(cache: BuildCache, plugin: Required<BasePlugin>): GraphQLObjectType {
//     return new GraphQLObjectType({
//       name: String(this.typename),
//       description: this.description,
//       interfaces: () =>
//         this.interfaces.map((type) => cache.getEntryOfType(type, 'Interface').built),
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
