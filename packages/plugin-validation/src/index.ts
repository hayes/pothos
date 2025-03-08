import './global-types';
import SchemaBuilder, {
  ArgumentRef,
  BasePlugin,
  FieldRef,
  type InputFieldMap,
  InputFieldRef,
  InputObjectRef,
  RootFieldBuilder,
  type PothosInputFieldConfig,
  type SchemaTypes,
  mapInputFields,
  type PothosOutputFieldConfig,
  type InputFieldsMapping,
  type InputFieldMapping,
  completeValue,
  isThenable,
  unwrapInputFieldType,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';
import type { GraphQLFieldResolver } from 'graphql';

export * from './types';

const pluginName = 'validation';

(RootFieldBuilder.prototype as RootFieldBuilder<SchemaTypes, unknown>).validate = function validate<
  Args extends InputFieldMap,
  R,
>(args: Args, _schema: StandardSchemaV1<unknown, R>) {
  return args as never;
};

(FieldRef.prototype as FieldRef<SchemaTypes>).validate = function validate(schema) {
  this.updateConfig((config) => {
    const extensions = (config.extensions ?? {}) as { validationSchemas?: StandardSchemaV1[] };

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
    const extensions = (config.extensions ?? {}) as { validationSchemas?: StandardSchemaV1[] };

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
    const extensions = (config.extensions ?? {}) as { validationSchemas?: StandardSchemaV1[] };

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
    const extensions = (config.extensions ?? {}) as { validationSchemas?: StandardSchemaV1[] };

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

export class InputValidationError extends PothosValidationError {
  issues: readonly StandardSchemaV1.Issue[];

  constructor(issues: readonly StandardSchemaV1.Issue[]) {
    super(issues.map((issue) => issue.message).join('\n'));

    this.issues = issues;
  }
}

export class PothosZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> {
    if (fieldConfig.pothosOptions.validate) {
      const extensions = (fieldConfig.extensions ?? {}) as {
        validationSchemas?: StandardSchemaV1[];
      };

      return {
        ...fieldConfig,
        extensions: {
          ...extensions,
          validationSchemas: [
            ...(extensions.validationSchemas ?? []),
            fieldConfig.pothosOptions.validate,
          ],
        },
      };
    }

    return fieldConfig;
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    if (fieldConfig.pothosOptions.validate) {
      const extensions = (fieldConfig.extensions ?? {}) as {
        validationSchemas?: StandardSchemaV1[];
      };

      return {
        ...fieldConfig,
        extensions: {
          ...extensions,
          validationSchemas: [
            ...(extensions.validationSchemas ?? []),
            fieldConfig.pothosOptions.validate,
          ],
        },
      };
    }

    return fieldConfig;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // Only used to check if validation is required
    const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (field) => {
      const fieldSchemas = (field.extensions?.validationSchemas as StandardSchemaV1[]) ?? null;
      const fieldTypeName = unwrapInputFieldType(field.type);
      const typeSchemas =
        (this.buildCache.getTypeConfig(fieldTypeName).extensions
          ?.validationSchemas as StandardSchemaV1[]) ?? null;

      return fieldSchemas || typeSchemas
        ? {
            fieldSchemas,
            typeSchemas,
          }
        : null;
    });

    const argsSchemas = fieldConfig.extensions?.validationSchemas as StandardSchemaV1[] | null;

    if (!argMappings && !argsSchemas) {
      return resolver;
    }

    const argValidator = createArgsValidator(argMappings, argsSchemas);

    return async (parent, rawArgs, context, info) =>
      completeValue(argValidator(rawArgs), (validated) => {
        return resolver(parent, validated as object, context, info);
      });
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosZodPlugin);

export default pluginName;

function createArgsValidator<Types extends SchemaTypes>(
  argMappings: InputFieldsMapping<
    Types,
    {
      typeSchemas: StandardSchemaV1[];
      fieldSchemas: StandardSchemaV1[];
    }
  > | null,
  argsSchemas: StandardSchemaV1[] | null,
) {
  const argMapper = argMappings
    ? createInputValueMapper(argMappings, (value, mappings, addIssues) => {
        const { typeSchemas, fieldSchemas } = mappings.value!;
        const mapped = typeSchemas
          ? reduceMaybeAsync(typeSchemas, value, (val, schema) =>
              completeValue(schema['~standard'].validate(val), (result) => {
                if (result.issues) {
                  addIssues(result.issues);
                  return null;
                }

                return result.value;
              }),
            )
          : value;

        if (mapped === null) {
          return value;
        }

        if (fieldSchemas) {
          return reduceMaybeAsync(fieldSchemas, mapped, (val, schema) =>
            completeValue(schema['~standard'].validate(val), (result) => {
              if (result.issues) {
                addIssues(result.issues);
                return null;
              }

              return result.value;
            }),
          );
        }

        return mapped;
      })
    : null;

  return function validateArgs(args: object) {
    return completeValue(
      argMapper ? argMapper(args) : { value: args, issues: undefined },
      (mapped) => {
        if (mapped.issues) {
          throw new InputValidationError(mapped.issues);
        }

        if (!argsSchemas) {
          return mapped.value;
        }

        const issues: StandardSchemaV1.Issue[] = [];

        const validated = reduceMaybeAsync(argsSchemas, mapped.value, (val, schema) =>
          completeValue(schema['~standard'].validate(val), (result) => {
            if (result.issues) {
              issues.push(...result.issues);
              return null;
            }

            return result.value;
          }),
        );

        return completeValue(validated, (result) => {
          if (issues.length) {
            throw new InputValidationError(issues);
          }

          return result;
        });
      },
    );
  };
}

function createInputValueMapper<Types extends SchemaTypes, T, Args extends unknown[] = []>(
  argMap: InputFieldsMapping<Types, T>,
  mapValue: (
    val: unknown,
    mapping: InputFieldMapping<Types, T>,
    addIssues: (issues: readonly StandardSchemaV1.Issue[]) => void,
    ...args: Args
  ) => unknown,
) {
  return function mapObject(
    obj: object,
    map: InputFieldsMapping<Types, T> = argMap,
    path: (string | number)[] = [],
    ...args: Args
  ): MaybePromise<StandardSchemaV1.Result<unknown>> {
    const mapped: Record<string, unknown> = { ...obj };
    const issues: StandardSchemaV1.Issue[] = [];

    function addIssues(path: (string | number)[]) {
      return (newIssues: readonly StandardSchemaV1.Issue[]) => {
        issues.push(
          ...newIssues.map((issue) => ({ ...issue, path: [...path, ...(issue.path ?? [])] })),
        );
      };
    }

    const promises: Promise<unknown>[] = [];

    map.forEach((field, fieldName) => {
      const fieldVal = (obj as Record<string, unknown>)[fieldName];
      const fieldPromises: Promise<unknown>[] = [];

      if (fieldVal === null || fieldVal === undefined) {
        mapped[fieldName] = fieldVal;
        return;
      }

      if (field.kind === 'InputObject' && field.fields.map) {
        if (field.isList) {
          const newList = [...(fieldVal as unknown[])];
          mapped[fieldName] = newList;

          (fieldVal as (Record<string, unknown> | null)[]).map((val, i) => {
            if (val) {
              const promise = completeValue(
                mapObject(val, field.fields.map!, [...path, fieldName, i], ...args),
                (newVal) => {
                  if (newVal.issues) {
                    issues.push(...newVal.issues);
                  } else {
                    newList[i] = newVal.value;
                  }
                },
              );

              if (isThenable(promise)) {
                fieldPromises.push(promise);
              }
            }
          });
        } else {
          const promise = completeValue(
            mapObject(
              fieldVal as Record<string, unknown>,
              field.fields.map,
              [...path, fieldName],
              ...args,
            ),
            (newVal) => {
              if (newVal.issues) {
                issues.push(...newVal.issues);
              } else {
                mapped[fieldName] = newVal.value;
              }
            },
          );

          if (isThenable(promise)) {
            fieldPromises.push(promise);
          }
        }
      }

      const promise = completeValue(
        fieldPromises.length ? Promise.all(fieldPromises) : null,
        () => {
          if (field.value !== null && !issues.length) {
            return completeValue(
              mapValue(mapped[fieldName], field, addIssues([...path, fieldName]), ...args),
              (newVal) => {
                mapped[fieldName] = newVal;
              },
            );
          }
        },
      );

      if (isThenable(promise)) {
        promises.push(promise);
      }
    });

    return completeValue(promises.length ? Promise.all(promises) : null, () => {
      return issues.length
        ? {
            issues,
          }
        : {
            value: mapped,
            issues: undefined,
          };
    });
  };
}
function reduceMaybeAsync<T, R>(
  items: T[],
  initialValue: R,
  fn: (value: R, item: T, i: number) => MaybePromise<R | null>,
) {
  function next(value: R, i: number): MaybePromise<R | null> {
    if (i === items.length) {
      return value;
    }

    return completeValue(fn(value, items[i], i), (result) => {
      return result === null ? null : next(result, i + 1);
    });
  }

  return next(initialValue, 0);
}
