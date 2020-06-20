import {
  TypeParam,
  InputTypeParam,
  FieldNullability,
  FieldRequiredness,
  SchemaTypes,
  OutputType,
  GiraphQLInputFieldType,
  GiraphQLNameInputFieldType,
  InputType,
  GiraphQLNameOutputFieldType,
  GiraphQLOutputFieldType,
} from '..';
import ConfigStore from '../config-store';

export function typeFromNonListParam<Types extends SchemaTypes>(
  ref: OutputType<Types>,
  configStore: ConfigStore<Types>,
  nullable: boolean,
): GiraphQLNameOutputFieldType<Types> {
  const typeConfig = configStore.getTypeConfig(ref);

  if (typeConfig.graphqlKind !== 'InputObject') {
    return {
      kind: typeConfig.graphqlKind,
      ref,
      nullable,
    };
  }

  throw new Error(
    `Expected input param ${typeConfig.name} to be an InputObject, Enum, or Scalar but got ${typeConfig.kind}`,
  );
}

export function typeFromParam<Types extends SchemaTypes>(
  param: TypeParam<Types>,
  configStore: ConfigStore<Types>,
  nullable: FieldNullability<[unknown]>,
): GiraphQLOutputFieldType<Types> {
  const itemNullable = typeof nullable === 'object' ? nullable.items : false;
  const listNullable = typeof nullable === 'object' ? nullable.list : !!nullable;

  if (Array.isArray(param)) {
    return {
      kind: 'List',
      type: typeFromNonListParam(param[0], configStore, itemNullable),
      nullable: listNullable,
    };
  }

  return typeFromNonListParam(param, configStore, listNullable);
}

export function inputTypeFromNonListParam<Types extends SchemaTypes>(
  ref: InputType<Types>,
  configStore: ConfigStore<Types>,
  required: boolean,
): GiraphQLNameInputFieldType<Types> {
  const typeConfig = configStore.getTypeConfig(ref);

  if (
    typeConfig.kind === 'InputObject' ||
    typeConfig.kind === 'Enum' ||
    typeConfig.kind === 'Scalar'
  ) {
    return {
      kind: typeConfig.graphqlKind,
      ref,
      required,
    };
  }

  throw new Error(
    `Expected input param ${typeConfig.name} to be an InputObject, Enum, or Scalar but got ${typeConfig.kind}`,
  );
}

export function inputTypeFromParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types>,
  configStore: ConfigStore<Types>,
  required: FieldRequiredness<[unknown]>,
): GiraphQLInputFieldType<Types> {
  const itemRequired = typeof required === 'object' ? required.items : true;
  const listRequired = typeof required === 'object' ? required.list : !!required;

  if (Array.isArray(param)) {
    return {
      kind: 'List',
      type: inputTypeFromNonListParam(param[0], configStore, itemRequired),
      required: listRequired,
    };
  }

  return inputTypeFromNonListParam(param, configStore, listRequired);
}
