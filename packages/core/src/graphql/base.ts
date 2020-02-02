import { GraphQLType } from 'graphql';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

export default abstract class BaseType<Shape = unknown, InputShape = Shape> {
  typename: string;

  shape?: Shape;

  inputShape?: InputShape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum' | 'Scalar' | 'InputObject' | 'Root';

  constructor(name: string, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(cache: BuildCache, plugins: BasePlugin[]): GraphQLType;
}
