import { FieldsShape, TypeParam } from '../types';
import { Field } from '..';

export default class FieldSet<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends TypeParam<Types>,
  ParentShape extends {
    [s: string]: Field<{}, Types, TypeParam<Types>, TypeParam<Types>, boolean, string | null, any>;
  } = {}
> {
  forType: Type;

  shape: FieldsShape<Types, Type, ParentShape>;

  constructor(type: Type, shape: FieldsShape<Types, Type, ParentShape>) {
    this.forType = type;
    this.shape = shape;
  }
}
