import FieldBuilder from './builder';

export default class ObjectFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape
> extends FieldBuilder<Types, ParentShape, 'Object'> {}
