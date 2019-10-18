import { GraphQLType } from 'graphql';

export default abstract class BaseType<Shape, Name extends string> {
  typename: Name;

  shape?: Shape;

  abstract kind: 'Object' | 'Union' | 'Interface' | 'Enum';

  constructor(name: Name, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }

  abstract buildType(typeMap: Map<string, GraphQLType>): GraphQLType;
}
