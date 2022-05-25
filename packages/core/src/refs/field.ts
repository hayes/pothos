import { FieldKind, outputFieldShapeKey } from '../types';

export default class FieldRef<T = unknown, Kind extends FieldKind = FieldKind> {
  kind: FieldKind;

  parentTypename: string;

  fieldName?: string;

  [outputFieldShapeKey]!: T;

  constructor(kind: Kind, parentTypename: string) {
    this.kind = kind;
    this.parentTypename = parentTypename;
  }

  toString() {
    if (this.fieldName) {
      return `${this.parentTypename}.${this.fieldName}`;
    }

    return this.parentTypename;
  }
}
