import { GraphQLType } from 'graphql';
import TypeStore from './store';
import { TypeMap } from './types';

export default abstract class BaseType<Types extends TypeMap, Name extends string, Shape> {
  typename: Name;

  shape?: Shape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum' | 'Scalar';

  constructor(name: Name, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(store: TypeStore<Types>): GraphQLType;
}
