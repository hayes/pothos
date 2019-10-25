import { GraphQLInputObjectType } from 'graphql';
import { InputFields, InputShapeFromFields, TypeMap } from './types';
import TypeStore from './store';
import BaseType from './base';

export default class InputObjectType<
  Types extends TypeMap,
  Shape extends InputShapeFromFields<Types, Fields>,
  Fields extends InputFields<Types> | null | undefined,
  Name extends string
> extends BaseType<Types, Name, Shape> {
  kind: 'InputObject' = 'InputObject';

  shape?: Shape;

  constructor(name: Name, fields?: Fields) {
    super(name);
  }

  buildType(store: TypeStore<any>) {
    return new GraphQLInputObjectType({
      name: this.typename,
      fields: {},
    });
  }
}
