import SchemaBuilder, {
  BasePlugin,
  SchemaTypes,
  ObjectRef,
  FieldMap,
  InterfaceRef,
  InterfaceParam,
} from '@giraphql/core';
import './global-types';
import { OutputShapeFromFields } from './types';

export default class SimpleObjectsPlugin implements BasePlugin {}

const proto: GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes> = SchemaBuilder.prototype;

proto.simpleObject = function simpleObject<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Fields extends FieldMap,
  Shape extends OutputShapeFromFields<Fields>
>(
  name: string,
  options: GiraphQLSchemaTypes.SimpleObjectTypeOptions<SchemaTypes, Interfaces, Fields, Shape>,
) {
  const ref = new ObjectRef<Shape>(name);

  if (options.fields) {
    const originalFields = options.fields;

    // eslint-disable-next-line no-param-reassign
    options.fields = (t) => {
      const fields = originalFields(t);

      Object.keys(fields).forEach((key) => {
        const config = this.configStore.getFieldConfig(fields[key], key, 'Object');

        config.resolve = (parent) => (parent as Record<string, unknown>)[key] as Readonly<unknown>;
      });

      return fields;
    };
  }

  this.objectType(ref, options as GiraphQLSchemaTypes.ObjectTypeOptions);

  return ref;
};

proto.simpleInterface = function simpleInterface<
  Fields extends FieldMap,
  Shape extends OutputShapeFromFields<Fields>
>(
  name: string,
  options: GiraphQLSchemaTypes.SimpleInterfaceTypeOptions<SchemaTypes, Fields, Shape>,
) {
  const ref = new InterfaceRef<Shape>(name);

  if (options.fields) {
    const originalFields = options.fields;

    // eslint-disable-next-line no-param-reassign
    options.fields = (t) => {
      const fields = originalFields(t);

      Object.keys(fields).forEach((key) => {
        const config = this.configStore.getFieldConfig(fields[key], key, 'Interface');

        config.resolve = (parent) => (parent as Record<string, unknown>)[key] as Readonly<unknown>;
      });

      return fields;
    };
  }

  this.interfaceType(ref, options as GiraphQLSchemaTypes.InterfaceTypeOptions);

  return ref;
};
