import {
  completeValue,
  type InputFieldMapping,
  type InputFieldsMapping,
  isThenable,
  type MaybePromise,
  type PartialResolveInfo,
  type SchemaTypes,
} from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema.js';

export function createArgsValidator<Types extends SchemaTypes>(
  argMappings: InputFieldsMapping<
    Types,
    {
      typeSchemas: StandardSchemaV1[];
      fieldSchemas: StandardSchemaV1[];
    }
  > | null,
  argsSchemas: StandardSchemaV1[] | StandardSchemaV1 | null,
  options: {
    validationError: (
      failure: StandardSchemaV1.FailureResult,
      args: Record<string, unknown>,
      context: Types['Context'],
      info: PartialResolveInfo,
    ) => Error;
  },
) {
  const argMapper = argMappings
    ? createInputValueMapper(
        argMappings,
        (value, mappings, addIssues) => {
          if (!mappings.value?.typeSchemas.length) {
            return value;
          }

          return completeValue(
            reduceSchemas(mappings.value.typeSchemas, value, addIssues),
            (result) => (result ? result.value : null),
          );
        },
        (mapped, mappings, addIssues) => {
          if (!mappings.value?.fieldSchemas.length) {
            return mapped;
          }

          return completeValue(
            reduceSchemas(mappings.value.fieldSchemas, mapped, addIssues),
            (result) => (result ? result.value : null),
          );
        },
      )
    : null;

  return function validateArgs(
    args: Record<string, unknown>,
    context: Types['Context'],
    info: PartialResolveInfo,
  ): MaybePromise<Record<string, unknown>> {
    return completeValue(
      argMapper ? argMapper(args) : { value: args, issues: undefined },
      (mapped) => {
        if (mapped.issues) {
          throw options.validationError(mapped, args, context, info);
        }

        const schemasArray = Array.isArray(argsSchemas)
          ? argsSchemas
          : argsSchemas
            ? [argsSchemas]
            : [];

        if (schemasArray.length === 0) {
          return mapped.value;
        }

        const issues: StandardSchemaV1.Issue[] = [];

        const validated = reduceSchemas(schemasArray, mapped.value, (newIssues) => {
          issues.push(...newIssues);
        });

        return completeValue(validated, (result) => {
          if (issues.length) {
            throw options.validationError({ issues }, args, context, info);
          }

          return (result as { value: unknown }).value as Record<string, unknown>;
        });
      },
    );
  };
}

function reduceSchemas(
  schemas: StandardSchemaV1[],
  initialValue: unknown,
  addIssues: (issues: readonly StandardSchemaV1.Issue[]) => void,
): MaybePromise<{ value: unknown } | null> {
  return reduceMaybeAsync<StandardSchemaV1, { value: unknown }>(
    schemas,
    { value: initialValue },
    (current, schema) =>
      completeValue(schema['~standard'].validate(current.value), (result) => {
        if (result.issues) {
          addIssues(result.issues);
          return null;
        }

        return { value: result.value };
      }),
  );
}

export function createInputValueMapper<Types extends SchemaTypes, T, Args extends unknown[] = []>(
  argMap: InputFieldsMapping<Types, T>,
  mapType: (
    val: unknown,
    mapping: InputFieldMapping<Types, T>,
    addIssues: (issues: readonly StandardSchemaV1.Issue[]) => void,
    ...args: Args
  ) => unknown,
  mapField: (
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
          ...newIssues.map((issue) =>
            Object.create(issue, {
              path: {
                value: [...path, ...(issue.path ?? [])],
                enumerable: true,
                configurable: true,
              },
              // NOTE: We inherit any getters that might be associated with the "message" property
              message: Object.getOwnPropertyDescriptor(issue, 'message') ?? {
                value: issue.message,
                enumerable: true,
                configurable: true,
              },
            }),
          ),
        );
      };
    }

    const promises: PromiseLike<unknown>[] = [];

    map.forEach((field, fieldName) => {
      const fieldVal = (obj as Record<string, unknown>)[fieldName];
      const fieldPath = [...path, fieldName];
      const fieldPromises: PromiseLike<unknown>[] = [];
      // per-field, so a failure only skips the remaining schemas for this field
      let hasIssues = false;
      const failedItems = new Set<string>();

      function addFieldIssues(indices: number[] = []) {
        const add = addIssues([...fieldPath, ...indices]);

        return (newIssues: readonly StandardSchemaV1.Issue[]) => {
          hasIssues = true;
          add(newIssues);
        };
      }

      if (fieldVal === null || fieldVal === undefined) {
        mapped[fieldName] = fieldVal;
        return;
      }

      if (field.kind === 'InputObject' && field.fields.map) {
        if (field.isList) {
          mapped[fieldName] = mapListValue(
            fieldVal as (Record<string, unknown> | null)[],
            field.listDepth,
            (val, i, newList, indices) => {
              if (val == null) {
                return val;
              }

              const result = mapObject(val, field.fields.map!, [...fieldPath, ...indices], ...args);

              const promise = completeValue(result, (newVal) => {
                if (newVal.issues) {
                  hasIssues = true;
                  failedItems.add(indices.join('.'));
                  issues.push(...newVal.issues);

                  return val;
                }

                newList[i] = newVal.value;

                return newVal.value;
              });

              if (isThenable(promise)) {
                fieldPromises.push(promise);
              }

              return promise;
            },
          );
        } else {
          const promise = completeValue(
            mapObject(fieldVal as Record<string, unknown>, field.fields.map, fieldPath, ...args),
            (newVal) => {
              if (newVal.issues) {
                hasIssues = true;
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
          if (field.value === null) {
            return;
          }

          if (field.isList) {
            const itemPromises: PromiseLike<unknown>[] = [];
            const list = mapListValue(
              mapped[fieldName],
              field.listDepth,
              (val, i, arr, indices) => {
                if (val == null || failedItems.has(indices.join('.'))) {
                  return val;
                }

                const result = mapType(val, field, addFieldIssues(indices), ...args);

                if (isThenable(result)) {
                  itemPromises.push(
                    completeValue(result, (newVal) => {
                      arr[i] = newVal;
                    }) as Promise<unknown>,
                  );
                }

                return result;
              },
            );

            return completeValue(itemPromises.length ? Promise.all(itemPromises) : null, () => {
              if (hasIssues) {
                return;
              }

              return completeValue(mapField(list, field, addFieldIssues(), ...args), (finalVal) => {
                mapped[fieldName] = finalVal;
              });
            });
          }

          if (hasIssues) {
            return;
          }

          return completeValue(
            mapType(mapped[fieldName], field, addFieldIssues(), ...args),
            (newVal) => {
              if (hasIssues) {
                return;
              }

              return completeValue(
                mapField(newVal, field, addFieldIssues(), ...args),
                (finalVal) => {
                  mapped[fieldName] = finalVal;
                },
              );
            },
          );
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

export function reduceMaybeAsync<T, R>(
  items: T[],
  initialValue: R,
  fn: (value: R, item: T, i: number) => MaybePromise<R | null>,
): MaybePromise<R | null> {
  function next(value: R, i: number): MaybePromise<R> {
    if (i === items.length) {
      return value;
    }

    return completeValue(fn(value, items[i], i), (result) => {
      return result === null ? (null as R) : next(result, i + 1);
    }) as MaybePromise<R>;
  }

  return next(initialValue, 0);
}

function mapListValue(
  value: unknown,
  listDepth: number,
  mapper: (val: unknown, i: number, array: unknown[], path: number[]) => unknown,
  currentIndices: number[] = [],
): unknown {
  if (listDepth === 0) {
    throw new Error('List depth must be greater than 0 for mapping');
  }

  if (!Array.isArray(value)) {
    return value;
  }

  const newList = [...value];

  for (let i = 0; i < newList.length; i++) {
    const indices = [...currentIndices, i];
    if (listDepth > 1) {
      newList[i] = mapListValue(newList[i], listDepth - 1, mapper, indices);
    } else {
      const result = mapper(newList[i], i, newList, indices);
      if (result !== undefined) {
        newList[i] = result;
      }
    }
  }

  return newList;
}
