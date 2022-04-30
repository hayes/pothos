import ConfigStore from '../config-store';
import BaseTypeRef from '../refs/base';
import {
  FieldNullability,
  FieldRequiredness,
  InputType,
  InputTypeParam,
  OutputType,
  PothosInputFieldType,
  PothosNameInputFieldType,
  PothosNameOutputFieldType,
  PothosOutputFieldType,
  SchemaTypes,
  TypeParam,
} from '../types';

export function typeFromNonListParam<Types extends SchemaTypes>(
  type: OutputType<Types>,
  configStore: ConfigStore<Types>,
  nullable: boolean,
): PothosNameOutputFieldType<Types> {
  const ref = configStore.getOutputTypeRef(type);
  const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
  const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;

  if (kind !== 'InputObject') {
    return {
      kind,
      ref,
      nullable,
    };
  }

  throw new Error(
    `Expected input param ${name} to be an InputObject, Enum, or Scalar but got ${kind}`,
  );
}

export function typeFromParam<Types extends SchemaTypes>(
  param: TypeParam<Types>,
  configStore: ConfigStore<Types>,
  nullable: FieldNullability<[unknown]>,
): PothosOutputFieldType<Types> {
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
  type: InputType<Types>,
  configStore: ConfigStore<Types>,
  required: boolean,
): PothosNameInputFieldType<Types> {
  const ref = configStore.getInputTypeRef(type);
  const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
  const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;

  if (kind === 'InputObject' || kind === 'Enum' || kind === 'Scalar') {
    return {
      kind,
      ref,
      required,
    };
  }

  throw new Error(
    `Expected input param ${name} to be an InputObject, Enum, or Scalar but got ${kind}`,
  );
}

export function inputTypeFromParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types>,
  configStore: ConfigStore<Types>,
  required: FieldRequiredness<[unknown]>,
): PothosInputFieldType<Types> {
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
