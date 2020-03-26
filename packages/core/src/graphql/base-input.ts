import BaseType from './base';

export default abstract class BaseInputType<Shape = unknown, InputShape = Shape> extends BaseType<
  Shape
> {
  shape?: Shape;

  inputShape?: InputShape;

  abstract kind: 'Enum' | 'Scalar' | 'InputObject';
}
