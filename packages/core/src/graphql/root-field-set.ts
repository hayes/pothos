import { RootFieldsShape, RootName } from '../types';

export default class RootFieldSet<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Kind extends RootName = RootName
> {
  forType: RootName;

  shape: RootFieldsShape<any, Kind>;

  constructor(type: RootName, shape: RootFieldsShape<Types, Kind>) {
    this.forType = type;
    this.shape = shape;
  }
}
