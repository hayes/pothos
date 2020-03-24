import { BaseType } from '..';

export default abstract class BaseInputType<Shape = unknown, InputShape = Shape> extends BaseType<
  Shape
> {
  shape?: Shape;

  inputShape?: InputShape;

  abstract kind: 'Enum' | 'Scalar' | 'InputObject';
}
