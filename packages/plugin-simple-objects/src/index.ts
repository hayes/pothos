import SchemaBuilder, {
  SchemaTypes,
  ObjectRef,
  FieldMap,
  InterfaceRef,
  InterfaceParam,
  InterfaceTypeOptions,
} from '@giraphql/core';
import './global-types';
import { OutputShapeFromFields } from './types';

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
        this.configStore.onFieldUse(fields[key], (config) => {
          if (config.kind === 'Object') {
            // eslint-disable-next-line no-param-reassign
            config.resolve = (parent) =>
              (parent as Record<string, unknown>)[key] as Readonly<unknown>;
          }
        });
      });

      return fields;
    };
  }

  this.objectType(ref, options as GiraphQLSchemaTypes.ObjectTypeOptions);

  return ref;
};

proto.simpleInterface = function simpleInterface<
  Fields extends FieldMap,
  Shape extends OutputShapeFromFields<Fields>,
  Interfaces extends InterfaceParam<SchemaTypes>[]
>(
  name: string,
  options: GiraphQLSchemaTypes.SimpleInterfaceTypeOptions<SchemaTypes, Fields, Shape, Interfaces>,
) {
  const ref = new InterfaceRef<Shape>(name);

  if (options.fields) {
    const originalFields = options.fields;

    // eslint-disable-next-line no-param-reassign
    options.fields = (t) => {
      const fields = originalFields(t);

      Object.keys(fields).forEach((key) => {
        this.configStore.onFieldUse(fields[key], (config) => {
          if (config.kind === 'Interface') {
            // eslint-disable-next-line no-param-reassign
            config.resolve = (parent) =>
              (parent as Record<string, unknown>)[key] as Readonly<unknown>;
          }
        });
      });

      return fields;
    };
  }

  this.interfaceType(
    ref,
    options as InterfaceTypeOptions<SchemaTypes, InterfaceParam<SchemaTypes>, Shape, Interfaces>,
  );

  return ref;
};
