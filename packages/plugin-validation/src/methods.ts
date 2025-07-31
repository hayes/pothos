import {
  ArgumentRef,
  FieldRef,
  type InputFieldMap,
  InputFieldRef,
  InputObjectRef,
  PothosSchemaError,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type * as standardSchema from './standard-schema';

(RootFieldBuilder.prototype as RootFieldBuilder<SchemaTypes, unknown>).validate = function validate<
  Args extends InputFieldMap,
  R,
>(args: Args, schema: standardSchema.StandardSchemaV1<unknown, R>) {
  // Store the validation schema for this args object
  const [firstArg] = Object.values(args);

  if (!firstArg) {
    throw new PothosSchemaError('t.validate() requires at least one argument to validate');
  }

  (firstArg as InputFieldRef<SchemaTypes, unknown>).updateConfig((config) => {
    const extensions = config.extensions ?? {};
    const existingParentSchemas = extensions['@pothos/plugin-validation']?.parentSchemas ?? [];

    return {
      ...config,
      extensions: {
        ...extensions,
        '@pothos/plugin-validation': {
          ...extensions['@pothos/plugin-validation'],
          parentSchemas: [...existingParentSchemas, schema],
        },
      },
    };
  });
  return args as never;
};

(FieldRef.prototype as FieldRef<SchemaTypes>).validate = function validate(schema) {
  this.updateConfig((config) => {
    const extensions = config.extensions ?? {};

    return {
      ...config,
      extensions: {
        ...extensions,
        '@pothos/plugin-validation': {
          ...extensions['@pothos/plugin-validation'],
          schemas: extensions['@pothos/plugin-validation']?.schemas
            ? [schema, ...extensions['@pothos/plugin-validation'].schemas]
            : [schema],
        },
      },
    };
  });
  return this as never;
};

(InputFieldRef.prototype as InputFieldRef<SchemaTypes, unknown>).validate = function validate(
  schema,
) {
  this.updateConfig((config) => {
    const extensions = config.extensions ?? {};

    return {
      ...config,
      extensions: {
        ...extensions,
        '@pothos/plugin-validation': {
          ...extensions['@pothos/plugin-validation'],
          schemas: extensions['@pothos/plugin-validation']?.schemas
            ? [schema, ...extensions['@pothos/plugin-validation'].schemas]
            : [schema],
        },
      },
    };
  });
  return this as never;
};

(ArgumentRef.prototype as ArgumentRef<SchemaTypes, unknown>).validate = function validate(schema) {
  this.updateConfig((config) => {
    const extensions = config.extensions ?? {};

    return {
      ...config,
      extensions: {
        ...extensions,
        '@pothos/plugin-validation': {
          ...extensions['@pothos/plugin-validation'],
          schemas: extensions['@pothos/plugin-validation']?.schemas
            ? [schema, ...extensions['@pothos/plugin-validation'].schemas]
            : [schema],
        },
      },
    };
  });
  return this as never;
};

(InputObjectRef.prototype as InputObjectRef<SchemaTypes, unknown>).validate = function validate(
  schema,
) {
  this.updateConfig((config) => {
    const extensions = config.extensions ?? {};

    return {
      ...config,
      extensions: {
        ...extensions,
        '@pothos/plugin-validation': {
          ...extensions['@pothos/plugin-validation'],
          schemas: extensions['@pothos/plugin-validation']?.schemas
            ? [schema, ...extensions['@pothos/plugin-validation'].schemas]
            : [schema],
        },
      },
    };
  });
  return this as never;
};
