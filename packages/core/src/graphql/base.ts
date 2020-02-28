import { GraphQLType } from 'graphql';
import BuildCache from '../build-cache';
import { BasePlugin } from '../plugins';

export default abstract class BaseType<Shape = unknown, InputShape = Shape> {
  typename: string;

  shape?: Shape;

  inputShape?: InputShape;

  abstract kind:
    | 'Object'
    | 'Union'
    | 'Interface'
    | 'Enum'
    | 'Scalar'
    | 'InputObject'
    | 'Query'
    | 'Mutation'
    | 'Subscription';

  constructor(name: string, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(cache: BuildCache, plugins: Required<BasePlugin>): GraphQLType;
}
