import { FieldsShape, TypeParam, ShapeFromTypeParam } from '../types';

export default class FieldSet<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends TypeParam<Types>
> {
  forType: Type;

  shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>>;

  constructor(type: Type, shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>>) {
    this.forType = type;
    this.shape = shape;
  }
}
