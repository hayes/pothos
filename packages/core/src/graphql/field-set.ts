import { FieldsShape } from '../types';

export default class FieldSet<Types extends GiraphQLSchemaTypes.TypeInfo, Shape = unknown> {
  kind: 'FieldSet' = 'FieldSet';

  forType: string;

  shape: FieldsShape<any, any>;

  constructor(type: string, shape: FieldsShape<Types, Shape>) {
    this.forType = type;
    this.shape = shape;
  }
}
