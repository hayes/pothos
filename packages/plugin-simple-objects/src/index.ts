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
    OutputShapeFromFields<Fields> & ParentShape<SchemaTypes, Interfaces[number]>
  >,
>(
  name: string,
  options: PothosSchemaTypes.SimpleObjectTypeOptions<SchemaTypes, Interfaces, Fields, Shape>,
  extraFields?: ObjectFieldsShape<SchemaTypes, Shape>,
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

  this.objectType(ref, options as PothosSchemaTypes.ObjectTypeOptions);

  if (extraFields) {
    this.objectFields(ref, extraFields);
  }

  return ref;
};

proto.simpleInterface = function simpleInterface<
  Fields extends FieldMap,
  Shape extends OutputShapeFromFields<Fields>,
  Interfaces extends InterfaceParam<SchemaTypes>[],
>(
  name: string,
  options: PothosSchemaTypes.SimpleInterfaceTypeOptions<SchemaTypes, Fields, Shape, Interfaces>,
  extraFields?: InterfaceFieldsShape<SchemaTypes, Shape>,
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

  this.interfaceType(ref, options as {});

  if (extraFields) {
    this.interfaceFields(ref, extraFields);
  }

  return ref;
};
