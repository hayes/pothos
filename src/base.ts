import { GraphQLType } from 'graphql';

export default abstract class BaseType<Shape> {
  typename: string;

  shape?: Shape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum';

  constructor(name: string, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(typeMap: Map<string, GraphQLType>): GraphQLType;
}
