import './global-types';
import {
  FieldMap,
  FieldRef,
  InterfaceParam,
  MaybePromise,
  ObjectParam,
  ObjectTypeOptions,
  ParentShape,
  SchemaTypes,
  ShapeFromTypeParam,
} from '@giraphql/core';

export const selectionShapeKey = Symbol.for('GiraphQL.federationSelectionKey');

export type EntityObjectOptions<
  Types extends SchemaTypes,
  Param extends ObjectParam<Types>,
  Interfaces extends InterfaceParam<Types>[],
  KeySelection extends Selection<object>,
> = Omit<ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>, 'fields'> & {
  key: KeySelection | KeySelection[];
  resolveReference: (
    parent: KeySelection[typeof selectionShapeKey],
  ) => MaybePromise<ShapeFromTypeParam<Types, Param, true>>;
  fields?: EntityObjectFieldsShape<Types, ShapeFromTypeParam<Types, Param, false>, FieldMap>;
};

export type EntityObjectFieldsShape<Types extends SchemaTypes, Shape, Fields extends FieldMap> = (
  t: GiraphQLSchemaTypes.FieldBuilder<Types, Shape, 'EntityObject'>,
) => Fields;

export type ShapeFromField<T extends FieldRef<unknown>> = T extends FieldRef<infer U> ? U : never;

export type ExternalEntityOptions<
  Types extends SchemaTypes,
  Shape extends object,
  Interfaces extends InterfaceParam<Types>[],
> = Omit<
  | GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>
  | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, Shape, Interfaces>,
  'fields'
> & {
  externalFields: ExternalFieldsShape<Types, {}>;
  fields?: ExtendedEntityFieldsShape<Types, Shape>;
};

export type ExtendedEntityFieldsShape<Types extends SchemaTypes, Shape> = (
  t: GiraphQLSchemaTypes.FieldBuilder<Types, Shape, 'ExtendedEntity'>,
) => FieldMap;

export type ExternalFieldsShape<Types extends SchemaTypes, Fields extends FieldMap> = (
  t: GiraphQLSchemaTypes.RootFieldBuilder<Types, unknown, 'ExternalEntity'>,
) => Fields;

export type ShapeFromExternalFields<Fields extends FieldMap> = {
  [K in keyof Fields]: ShapeFromField<Fields[K]> extends Date | boolean | number | string
    ? ShapeFromField<Fields[K]>
    : unknown;
};

export type SelectionFromShape<Shape extends {}, Space extends string = ''> = {} extends Shape
  ? ''
  : {
      [K in keyof Shape]: Omit<Shape, K> extends infer R
        ? Required<Shape[K]> extends object
          ? `${Space}${K & string} { ${Shape[K] extends infer T
              ? SelectionFromShape<T>
              : never} }${SelectionFromShape<R, ' '>}`
          : `${Space}${K & string}${SelectionFromShape<R, ' '>}`
        : never;
    }[keyof Shape];

export interface Selection<Shape extends object> {
  selection: string;
  [selectionShapeKey]: Shape;
}
