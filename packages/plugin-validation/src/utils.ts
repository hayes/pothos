import {
  completeValue,
  type InputFieldMapping,
  type InputFieldsMapping,
  isThenable,
  type MaybePromise,
  type SchemaTypes,
} from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';
import { InputValidationError } from './errors';

export function createArgsValidator<Types extends SchemaTypes>(
  argMappings: InputFieldsMapping<
    Types,
    {
      typeSchemas: StandardSchemaV1[];
      fieldSchemas: StandardSchemaV1[];
    }
  > | null,
  argsSchema: StandardSchemaV1 | null,
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

  return function validateArgs(
    args: Record<string, unknown>,
  ): MaybePromise<Record<string, unknown>> {
    return completeValue(
      argMapper ? argMapper(args) : { value: args, issues: undefined },
      (mapped) => {
        if (mapped.issues) {
          throw new InputValidationError(mapped.issues);
        }

        if (!argsSchema) {
          return mapped.value;
        }

        const issues: StandardSchemaV1.Issue[] = [];

        const validated = completeValue(
          argsSchema['~standard'].validate(mapped.value),
          (result) => {
            if (result.issues) {
              issues.push(...result.issues);
              return null;
            }

            return result.value;
          },
        );

        return completeValue(validated, (result) => {
          if (issues.length) {
            throw new InputValidationError(issues);
          }

          return result as Record<string, unknown>;
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
  ): MaybePromise<StandardSchemaV1.Result<Record<string, unknown>>> {
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
