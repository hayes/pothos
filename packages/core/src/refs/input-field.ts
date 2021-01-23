import { FieldRef } from '..';
import { inputFieldShapeKey } from '../types';

export default class InputFieldRef<
  T = unknown,
  Kind extends 'InputObject' | 'Arg' = 'InputObject' | 'Arg'
> {
  kind: 'InputObject' | 'Arg';

  parentTypename: string;

  fieldName?: string;

  argFor?: InputFieldRef | FieldRef;

  [inputFieldShapeKey]: T;

  constructor(kind: Kind, parentTypename: string) {
    this.kind = kind;
    this.parentTypename = parentTypename;
  }

  toString() {
    if (this.kind !== 'Arg') {
      if (this.fieldName) {
        return `${this.parentTypename}.${this.fieldName}`;
      }

      return this.parentTypename;
    }
    const fieldName = this.argFor?.fieldName || '[unnamed filed]';
    const argName = this.fieldName || '[unnamed argument]';

    return `${this.parentTypename}.${fieldName}(${argName})`;
  }
}
