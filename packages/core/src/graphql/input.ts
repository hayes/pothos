// // @ts-ignore
// import fromEntries from 'object.fromentries';
// import { GraphQLInputFieldConfigMap, GraphQLInputObjectType } from 'graphql';

// import InputFieldBuilder from '../fieldUtils/input';
// import BuildCache from '../build-cache';
// import BaseInputType from './base-input';
// import { buildArg } from '../utils';
// import { BaseType } from '..';

// export default class InputObjectType extends BaseInputType {
//   kind: 'InputObject' = 'InputObject';

//   options: GiraphQLSchemaTypes.InputTypeOptions<any, any>;

//   constructor(name: string, options: GiraphQLSchemaTypes.InputTypeOptions) {
//     super(name);

//     this.options = options;
//   }

//   buildFields(cache: BuildCache): GraphQLInputFieldConfigMap {
//     const fields = this.options.shape(new InputFieldBuilder());

//     return fromEntries(
//       Object.keys(fields).map((key) => {
//         const field = fields[key];
//         return [
//           key,
//           {
//             description:
//               typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
//                 ? undefined
//                 : field.description,
//             required:
//               typeof field !== 'object' || field instanceof BaseType || Array.isArray(field)
//                 ? false
//                 : field.required ?? false,
//             type: buildArg(field, cache),
//           },
//         ];
//       }),
//     ) as GraphQLInputFieldConfigMap;
//   }

//   buildType(cache: BuildCache) {
//     return new GraphQLInputObjectType({
//       name: this.typename,
//       description: this.options.description,
//       fields: () => this.buildFields(cache),
//       extensions: this.options.extensions,
//     });
//   }
// }
