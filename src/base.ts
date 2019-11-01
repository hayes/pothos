import { GraphQLType } from 'graphql';
import TypeStore from './store';
import { TypeMap } from './types';

export default abstract class BaseType<
  Types extends TypeMap,
  Name extends string | keyof Types['Input'] | keyof Types['Output'],
  Shape,
  InputShape = Shape
> {
  typename: Name;

  shape?: Shape;

  inputShape?: InputShape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum' | 'Scalar' | 'InputObject';

  constructor(name: Name, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(store: TypeStore<Types>): GraphQLType;
}
