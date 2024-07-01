import './global-types';
import { FieldMap, FieldRef, GenericFieldRef, InterfaceParam, SchemaTypes } from '@pothos/core';

export const selectionShapeKey = Symbol.for('Pothos.federationSelectionKey');

export type EntityObjectFieldsShape<Types extends SchemaTypes, Shape, Fields extends FieldMap> = (
  t: PothosSchemaTypes.FieldBuilder<Types, Shape, 'EntityObject'>,
) => Fields;

export type ShapeFromField<T extends GenericFieldRef> = T extends FieldRef<infer U> ? U : never;

export type ExternalEntityOptions<
  Types extends SchemaTypes,
  Shape extends object,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  | PothosSchemaTypes.ObjectTypeOptions<Types, Shape>
  | PothosSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
  'fields'
> & {
  externalFields?: ExternalFieldsShape<Types, {}>;
  fields?: ExtendedEntityFieldsShape<Types, Shape>;
};

export type ExtendedEntityFieldsShape<Types extends SchemaTypes, Shape> = (
  t: PothosSchemaTypes.FieldBuilder<Types, Shape, 'ExtendedEntity'>,
) => FieldMap;

export type ExternalFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (
  t: PothosSchemaTypes.RootFieldBuilder<Types, unknown, 'ExternalEntity'>,
) => Fields;

export type ShapeFromExternalFields<Fields extends FieldMap> = {
  [K in keyof Fields]: ShapeFromField<Fields[K]> extends Date | boolean | number | string
    ? ShapeFromField<Fields[K]>
    : unknown;
};

export type SelectionFromShape<Shape, Space extends string = ''> = {} extends Required<Shape>
  ? ''
  : {
      [K in keyof Shape]: Omit<Shape, K> extends infer R
        ? NonNullable<Shape[K]> extends object
          ? `${Space}${K & string} { ${NonNullable<Shape[K]> extends infer T
              ? SelectionFromShape<T>
              : never} }${SelectionFromShape<R, ' '>}`
          : `${Space}${K & string}${SelectionFromShape<R, ' '>}`
        : never;
    }[keyof Shape];

export interface Selection<Shape extends object> {
  selection: string;
  [selectionShapeKey]: Shape;
}

export interface KeyDirective<Shape extends object, Resolvable extends boolean = true>
  extends Selection<Shape> {
  resolvable?: Resolvable;
}
