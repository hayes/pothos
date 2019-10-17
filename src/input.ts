import { InputFields, InputShapeFromFields } from './types';

export default class InputType<Shape> {
  name: string;

  shape?: Shape;

  constructor(name: string) {
    this.name = name;
  }

  static createInputType<
    Name extends string,
    Fields extends InputFields,
    Shape extends InputShapeFromFields<Fields>
  >(name: Name, fields: Fields) {
    return new InputType<Shape>(name);
  }
}
