import { outputFieldShapeKey, FieldKind } from '../types';

export default class FieldRef<T = unknown, Kind extends FieldKind = FieldKind> {
  kind: FieldKind;

  [outputFieldShapeKey]: T;

  constructor(kind: Kind) {
    this.kind = kind;
  }
}
