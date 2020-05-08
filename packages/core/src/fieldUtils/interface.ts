import FieldBuilder from './builder';
import { SchemaTypes } from '../types';

export default class InterfaceFieldBuilder<
  Types extends SchemaTypes,
  ParentShape
> extends FieldBuilder<Types, ParentShape, 'Interface'> {}
