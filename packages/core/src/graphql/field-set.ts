import { FieldsShape, TypeParam, ShapeFromTypeParam } from '../types';

export default class FieldSet<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends TypeParam<Types> = TypeParam<Types>
> {
  forType: string;

  shape: FieldsShape<any, any>;

  constructor(type: string, shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>>) {
    this.forType = type;
    this.shape = shape as FieldsShape<any, any>;
  }
}
