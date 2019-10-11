// import BaseType from './base';
// import { TypeMap } from './types';

// export default class Field<Types extends TypeMap> {
//   name: string;
//   type: keyof Types;
//   args: BaseType<Types>;

//   options: {
//     description?: string;
//     deprecationReason?: string;
//   };

//   constructor(
//     name: string,
//     type: keyof Types,
//     args: BaseType<Types>[],
//     resolver: Function,
//     options: {
//       description?: string;
//       deprecationReason?: string;
//     },
//   ) {
//     this.name = name;
//     this.type = type;
//     this.args = args;
//     this.resolver = resolver;
//     this.options = options;
//   }
// }
