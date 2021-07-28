import './global-types';
import SchemaBuilder, { FieldNullability, SchemaTypes, TypeParam } from '@giraphql/core';
import { PrismaObjectFieldBuilder } from './field-builder';
import { getRefFromModel, setFindUniqueForRef } from './refs';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.prismaObject = function prismaObject(type, { fields, findUnique, ...options }) {
  const ref = getRefFromModel(type, this);
  const name = (options.name ?? type) as string;

  ref.name = name;

  setFindUniqueForRef(ref, this, findUnique);

  this.objectType(ref, {
    ...(options as {} as GiraphQLSchemaTypes.ObjectFieldOptions<
      SchemaTypes,
      unknown,
      TypeParam<SchemaTypes>,
      FieldNullability<SchemaTypes>,
      {},
      unknown
    >),
    name,
    fields: fields ? () => fields(new PrismaObjectFieldBuilder(name, this, type)) : undefined,
  });

  return ref as never;
};
