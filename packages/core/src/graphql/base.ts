import { GraphQLType } from 'graphql';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

export default abstract class BaseType<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends string | keyof Types['Input'] | keyof Types['Output'],
  Shape,
  InputShape = Shape,
  MatchShape = Shape
> {
  typename: Name;

  shape?: Shape;

  inputShape?: InputShape;

  matchShape?: MatchShape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum' | 'Scalar' | 'InputObject';

  constructor(name: Name, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(cache: BuildCache<Types>, plugins: BasePlugin<Types>[]): GraphQLType;
}
