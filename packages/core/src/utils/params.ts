import type { ConfigStore } from '../config-store';
import { PothosSchemaError } from '../errors';
import { BaseTypeRef } from '../refs/base';
import { ListRef } from '../refs/list';
import { NonNullRef } from '../refs/non-null';
import {
  FieldNullability,
  FieldRequiredness,
  InputRef,
  InputType,
  OutputType,
  PothosInputFieldType,
  PothosOutputFieldType,
  SchemaTypes,
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
  param: OutputType<Types> | [OutputType<Types>],
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
      type: typeFromParam(param.listType as OutputType<Types>, configStore, false),
      nonNull,
    };
  }

  const ref = configStore.getOutputTypeRef(param);

  let kind;
  let name;

  if (ref instanceof BaseTypeRef) {
    if (ref.kind === 'NonNull') {
      return typeFromParam((ref as NonNullRef<Types, OutputType<Types>>).type, configStore, true);
    }
    // eslint-disable-next-line prefer-destructuring
    kind = ref.kind;
    // eslint-disable-next-line prefer-destructuring
    name = ref.name;
  } else {
    const typeConfig = configStore.getTypeConfig(ref);
    kind = typeConfig.graphqlKind;
    // eslint-disable-next-line prefer-destructuring
    name = typeConfig.name;
  }

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
  param: InputType<Types> | [InputType<Types>],
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

  if (param instanceof ListRef) {
    return {
      kind: 'List',
      type: inputTypeFromParam(param.listType as InputRef<Types>, configStore, false),
      required,
    };
  }

  const ref = configStore.getInputTypeRef(param);

  let kind;
  let name;

  if (ref instanceof BaseTypeRef) {
    if (ref.kind === 'NonNull') {
      return inputTypeFromParam(
        (ref as NonNullRef<Types, InputType<Types>>).type,
        configStore,
        true,
      );
    }
    // eslint-disable-next-line prefer-destructuring
    kind = ref.kind;
    // eslint-disable-next-line prefer-destructuring
    name = ref.name;
  } else {
    const typeConfig = configStore.getTypeConfig(ref);
    kind = typeConfig.graphqlKind;
    // eslint-disable-next-line prefer-destructuring
    name = typeConfig.name;
  }

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
