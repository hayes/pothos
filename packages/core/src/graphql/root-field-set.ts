import { RootName, RootFieldsShape } from '../types';

export default class RootFieldSet<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Type extends RootName
> {
  forType: Type;

  shape: RootFieldsShape<Types, Type>;

  constructor(type: Type, shape: RootFieldsShape<Types, Type>) {
    this.forType = type;
    this.shape = shape;
  }
}
