import type { ConfigStore } from '../config-store';
import { PothosSchemaError } from '../errors';
import { BaseTypeRef } from '../refs/base';
import { InputListRef } from '../refs/input-list';
import { ListRef } from '../refs/list';
import {
  FieldNullability,
  FieldRequiredness,
  InputType,
  InputTypeParam,
  OutputType,
  PothosInputFieldType,
  PothosOutputFieldType,
  SchemaTypes,
  TypeParam,
} from '../types';

export function unwrapOutputFieldType<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
): OutputType<Types> {
  if (type.kind === 'List') {
    return unwrapOutputFieldType(type.type);
  }

  return type.ref;
}

export function typeFromParam<Types extends SchemaTypes>(
  param: TypeParam<Types>,
  configStore: ConfigStore<Types>,
  nonNullOption: FieldNullability<[unknown]>,
): PothosOutputFieldType<Types> {
  const itemsNonNull = typeof nonNullOption === 'object' ? nonNullOption.items : true;
  const nonNull = typeof nonNullOption === 'object' ? nonNullOption.list : !!nonNullOption;

  if (Array.isArray(param)) {
    return {
      kind: 'List',
      type: typeFromParam(param[0], configStore, itemsNonNull),
      nonNull,
    };
  }

  if (param instanceof ListRef) {
    return {
      kind: 'List',
      type: typeFromParam(param.listType as TypeParam<Types>, configStore, param.nonNull),
      nonNull,
    };
  }

  const ref = configStore.getOutputTypeRef(param);
  const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
  const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;

  if (kind !== 'InputObject' && kind !== 'List' && kind !== 'InputList') {
    return {
      kind,
      ref,
      nonNull,
    };
  }

  throw new PothosSchemaError(`Expected input param ${name} to be an output type but got ${kind}`);
}

export function unwrapInputFieldType<Types extends SchemaTypes>(
  type: PothosInputFieldType<Types>,
): InputType<Types> {
  if (type.kind === 'List') {
    return unwrapInputFieldType(type.type);
  }

  return type.ref;
}

export function inputTypeFromParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types>,
  configStore: ConfigStore<Types>,
  requiredOption: FieldRequiredness<[unknown]>,
): PothosInputFieldType<Types> {
  const itemRequired = typeof requiredOption === 'object' ? requiredOption.items : true;
  const required = typeof requiredOption === 'object' ? requiredOption.list : !!requiredOption;

  if (Array.isArray(param)) {
    return {
      kind: 'List',
      type: inputTypeFromParam(param[0], configStore, itemRequired),
      required,
    };
  }

  if (param instanceof InputListRef) {
    return {
      kind: 'List',
      type: inputTypeFromParam(
        param.listType as InputTypeParam<Types>,
        configStore,
        param.required,
      ),
      required,
    };
  }

  const ref = configStore.getInputTypeRef(param);
  const kind = ref instanceof BaseTypeRef ? ref.kind : configStore.getTypeConfig(ref).graphqlKind;
  const name = ref instanceof BaseTypeRef ? ref.name : configStore.getTypeConfig(ref).name;

  if (kind === 'InputObject' || kind === 'Enum' || kind === 'Scalar') {
    return {
      kind,
      ref,
      required,
    };
  }

  throw new PothosSchemaError(
    `Expected input param ${name} to be an InputObject, Enum, or Scalar but got ${kind}`,
  );
}
