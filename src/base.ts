export default class BaseType<Shape> {
  typename: string;

  shape?: Shape;

  constructor(name: string, shape?: Shape) {
    this.typename = name;
    this.shape = shape;
  }
}
