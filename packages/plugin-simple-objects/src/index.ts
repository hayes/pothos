import './global-types';
import SchemaBuilder, {
  BasePlugin,
  FieldMap,
  InterfaceFieldsShape,
  InterfaceParam,
  InterfaceRef,
  Normalize,
  ObjectFieldsShape,
  ObjectRef,
  ParentShape,
  SchemaTypes,
  UnionToIntersection,
} from '@pothos/core';
import { OutputShapeFromFields } from './types';

const pluginName = 'simpleObjects';

export default pluginName;

export class PothosSimpleObjectsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, PothosSimpleObjectsPlugin);

const proto: PothosSchemaTypes.SchemaBuilder<SchemaTypes> =
  SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

proto.simpleObject = function simpleObject<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Fields extends FieldMap,
  Shape extends Normalize<
    OutputShapeFromFields<Fields> &
      UnionToIntersection<ParentShape<SchemaTypes, Interfaces[number]>>
  >,
>(
  name: string,
  options: PothosSchemaTypes.SimpleObjectTypeOptions<SchemaTypes, Interfaces, Fields, Shape>,
  extraFields?: ObjectFieldsShape<SchemaTypes, Shape>,
) {
  const ref = new ObjectRef<SchemaTypes, Shape>(name);

  this.objectType(ref, options as PothosSchemaTypes.ObjectTypeOptions);

  if (extraFields) {
    this.objectFields(ref, extraFields);
  }

  return ref;
};

proto.simpleInterface = function simpleInterface<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Fields extends FieldMap,
  Shape extends Normalize<
    OutputShapeFromFields<Fields> &
      UnionToIntersection<ParentShape<SchemaTypes, Interfaces[number]>>
  >,
>(
  name: string,
  options: PothosSchemaTypes.SimpleInterfaceTypeOptions<SchemaTypes, Interfaces, Fields, Shape>,
  extraFields?: InterfaceFieldsShape<SchemaTypes, Shape>,
) {
  const ref = new InterfaceRef<SchemaTypes, Shape>(name);

  this.interfaceType(ref, options as {});

  if (extraFields) {
    this.interfaceFields(ref, extraFields);
  }

  return ref;
};
