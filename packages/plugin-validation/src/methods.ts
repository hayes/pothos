import {
  ArgumentRef,
  FieldRef,
  type InputFieldMap,
  InputFieldRef,
  InputObjectRef,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type * as standardSchema from './standard-schema';

(RootFieldBuilder.prototype as RootFieldBuilder<SchemaTypes, unknown>).validate = function validate<
  Args extends InputFieldMap,
  R,
>(args: Args, _schema: standardSchema.StandardSchemaV1<unknown, R>) {
  return args as never;
};

(FieldRef.prototype as FieldRef<SchemaTypes>).validate = function validate(schema) {
  this.updateConfig((config) => {
    const extensions = (config.extensions ?? {}) as {
      validationSchemas?: standardSchema.StandardSchemaV1[];
    };

    return {
      ...config,
      extensions: {
        ...extensions,
        validationSchemas: extensions.validationSchemas
          ? [schema, ...extensions.validationSchemas]
          : [schema],
      },
    };
  });
  return this as never;
};

(InputFieldRef.prototype as InputFieldRef<SchemaTypes, unknown>).validate = function validate(
  schema,
) {
  this.updateConfig((config) => {
    const extensions = (config.extensions ?? {}) as {
      validationSchemas?: standardSchema.StandardSchemaV1[];
    };

    return {
      ...config,
      extensions: {
        ...extensions,
        validationSchemas: extensions.validationSchemas
          ? [schema, ...extensions.validationSchemas]
          : [schema],
      },
    };
  });
  return this as never;
};

(ArgumentRef.prototype as ArgumentRef<SchemaTypes, unknown>).validate = function validate(schema) {
  this.updateConfig((config) => {
    const extensions = (config.extensions ?? {}) as {
      validationSchemas?: standardSchema.StandardSchemaV1[];
    };

    return {
      ...config,
      extensions: {
        ...extensions,
        validationSchemas: extensions.validationSchemas
          ? [schema, ...extensions.validationSchemas]
          : [schema],
      },
    };
  });
  return this as never;
};

(InputObjectRef.prototype as InputObjectRef<SchemaTypes, unknown>).validate = function validate(
  schema,
) {
  this.updateConfig((config) => {
    const extensions = (config.extensions ?? {}) as {
      validationSchemas?: standardSchema.StandardSchemaV1[];
    };

    return {
      ...config,
      extensions: {
        ...extensions,
        validationSchemas: extensions.validationSchemas
          ? [schema, ...extensions.validationSchemas]
          : [schema],
      },
    };
  });
  return this as never;
};
