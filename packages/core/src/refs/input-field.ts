import { inputFieldShapeKey } from '../types';

export default class InputFieldRef<
  T = unknown,
  Kind extends 'InputObject' | 'Arg' = 'InputObject' | 'Arg'
> {
  kind: 'InputObject' | 'Arg';

  [inputFieldShapeKey]: T;

  constructor(kind: Kind) {
    this.kind = kind;
  }

  toString() {
    return `${this.kind}FieldRef`;
  }
}
