import { GraphQLInputObjectType } from 'graphql';
import { InputFields, InputShapeFromFields } from './types';
import TypeStore from './store';

export default class InputType<
  Shape extends InputShapeFromFields<Fields>,
  Fields extends InputFields | null | undefined,
  Name extends string
> {
  typename: Name;

  kind: 'InputObject' = 'InputObject';

  shape?: Shape;

  constructor(name: Name, fields?: Fields) {
    this.typename = name;
  }

  buildType(store: TypeStore<any>) {
    return new GraphQLInputObjectType({
      name: this.typename,
      fields: {},
    });
  }
}
