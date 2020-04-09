import FieldBuilder from './builder';

export default class InterfaceFieldBuilder<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  ParentShape
> extends FieldBuilder<Types, ParentShape, 'Interface'> {}
