import { completeValue, isThenable } from '@pothos/core';
import { InputValidationError } from './errors.js';
export function createArgsValidator(argMappings, argsSchema) {
    const argMapper = argMappings ? createInputValueMapper(argMappings, (value, mappings, addIssues) => {
        const { typeSchemas, fieldSchemas } = mappings.value;
        const mapped = typeSchemas ? reduceMaybeAsync(typeSchemas, value, (val, schema) => completeValue(schema["~standard"].validate(val), (result) => {
            if (result.issues) {
                addIssues(result.issues);
                return null;
            }
            return result.value;
        })) : value;
        if (mapped === null) {
            return value;
        }
        if (fieldSchemas) {
            return reduceMaybeAsync(fieldSchemas, mapped, (val, schema) => completeValue(schema["~standard"].validate(val), (result) => {
                if (result.issues) {
                    addIssues(result.issues);
                    return null;
                }
                return result.value;
            }));
        }
        return mapped;
    }) : null;
    return function validateArgs(args) {
        return completeValue(argMapper ? argMapper(args) : {
            value: args,
            issues: undefined
        }, (mapped) => {
            if (mapped.issues) {
                throw new InputValidationError(mapped.issues);
            }
            if (!argsSchema) {
                return mapped.value;
            }
            const issues = [];
            const validated = completeValue(argsSchema["~standard"].validate(mapped.value), (result) => {
                if (result.issues) {
                    issues.push(...result.issues);
                    return null;
                }
                return result.value;
            });
            return completeValue(validated, (result) => {
                if (issues.length) {
                    throw new InputValidationError(issues);
                }
                return result;
            });
        });
    };
}
function createInputValueMapper(argMap, mapValue) {
    return function mapObject(obj, map = argMap, path = [], ...args) {
        const mapped = {
            ...obj
        };
        const issues = [];
        function addIssues(path) {
            return (newIssues) => {
                issues.push(...newIssues.map((issue) => {
                    var _issue_path;
                    return {
                        ...issue,
                        path: [
                            ...path,
                            ...(_issue_path = issue.path) !== null && _issue_path !== void 0 ? _issue_path : []
                        ]
                    };
                }));
            };
        }
        const promises = [];
        map.forEach((field, fieldName) => {
            const fieldVal = obj[fieldName];
            const fieldPromises = [];
            if (fieldVal === null || fieldVal === undefined) {
                mapped[fieldName] = fieldVal;
                return;
            }
            if (field.kind === "InputObject" && field.fields.map) {
                if (field.isList) {
                    const newList = [
                        ...fieldVal
                    ];
                    mapped[fieldName] = newList;
                    fieldVal.map((val, i) => {
                        if (val) {
                            const promise = completeValue(mapObject(val, field.fields.map, [
                                ...path,
                                fieldName,
                                i
                            ], ...args), (newVal) => {
                                if (newVal.issues) {
                                    issues.push(...newVal.issues);
                                }
                                else {
                                    newList[i] = newVal.value;
                                }
                            });
                            if (isThenable(promise)) {
                                fieldPromises.push(promise);
                            }
                        }
                    });
                }
                else {
                    const promise = completeValue(mapObject(fieldVal, field.fields.map, [
                        ...path,
                        fieldName
                    ], ...args), (newVal) => {
                        if (newVal.issues) {
                            issues.push(...newVal.issues);
                        }
                        else {
                            mapped[fieldName] = newVal.value;
                        }
                    });
                    if (isThenable(promise)) {
                        fieldPromises.push(promise);
                    }
                }
            }
            const promise = completeValue(fieldPromises.length ? Promise.all(fieldPromises) : null, () => {
                if (field.value !== null && !issues.length) {
                    return completeValue(mapValue(mapped[fieldName], field, addIssues([
                        ...path,
                        fieldName
                    ]), ...args), (newVal) => {
                        mapped[fieldName] = newVal;
                    });
                }
            });
            if (isThenable(promise)) {
                promises.push(promise);
            }
        });
        return completeValue(promises.length ? Promise.all(promises) : null, () => {
            return issues.length ? {
                issues
            } : {
                value: mapped,
                issues: undefined
            };
        });
    };
}
function reduceMaybeAsync(items, initialValue, fn) {
    function next(value, i) {
        if (i === items.length) {
            return value;
        }
        return completeValue(fn(value, items[i], i), (result) => {
            return result === null ? null : next(result, i + 1);
        });
    }
    return next(initialValue, 0);
}
//# sourceMappingURL=utils.js.map
