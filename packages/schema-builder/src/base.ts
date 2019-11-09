import { GraphQLType } from 'graphql';
import TypeStore from './store';
import BasePlugin from './plugin';

export default abstract class BaseType<
  Types extends SpiderSchemaTypes.TypeInfo,
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

  abstract buildType(store: TypeStore<Types>, plugins: BasePlugin<Types>[]): GraphQLType;
}
