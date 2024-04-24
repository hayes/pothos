import SchemaBuilder, { ObjectRef, SchemaTypes } from '@pothos/core';
import { DrizzleObjectFieldBuilder } from './drizzle-field-builder';
import { getRefFromModel } from './utils/refs';

const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.drizzleObject = function drizzleObject(
  table,
  { name, select, fields, ...options },
) {
  const ref = getRefFromModel(table, this, 'object') as ObjectRef<SchemaTypes, unknown>;

  ref.name = name ?? table;

  this.objectType(ref, {
    ...(options as {}),
    extensions: {
      ...options.extensions,
      pothosDrizzleModel: table,
      pothosDrizzleTable: this.options.drizzle.client._.schema?.[table],
      pothosDrizzleSelect: select,
    },
    name,
    fields: fields ? () => fields(new DrizzleObjectFieldBuilder(ref.name, this, table)) : undefined,
  });

  return ref as never;
};

schemaBuilderProto.drizzleObjectField = function drizzleObjectField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new DrizzleObjectFieldBuilder(name, this, ref.tableName)),
    }));
  });
};

schemaBuilderProto.drizzleInterfaceField = function drizzleInterfaceField(type, fieldName, field) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new DrizzleObjectFieldBuilder(name, this, ref.tableName, 'Interface')),
    }));
  });
};

schemaBuilderProto.drizzleObjectFields = function drizzleObjectFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(new DrizzleObjectFieldBuilder(name, this, ref.tableName)),
    );
  });
};

schemaBuilderProto.drizzleInterfaceFields = function drizzleInterfaceFields(type, fields) {
  const ref = typeof type === 'string' ? getRefFromModel(type, this) : (type as never);
  this.configStore.onTypeConfig(ref, ({ name }) => {
    this.configStore.addFields(ref, () =>
      fields(new DrizzleObjectFieldBuilder(name, this, ref.tableName, 'Interface')),
    );
  });
};
