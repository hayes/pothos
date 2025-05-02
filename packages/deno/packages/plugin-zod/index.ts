// @ts-nocheck
import './global-types.ts';
import SchemaBuilder, { BasePlugin, type InputTypeFieldsMapping, mapInputFields, type PothosInputFieldConfig, type PothosInputFieldType, type PothosOutputFieldConfig, PothosSchemaError, PothosValidationError, resolveInputTypeConfig, type SchemaTypes, } from '../core/index.ts';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import * as zod from 'https://cdn.skypack.dev/zod@v1.11.17?dts';
import createZodSchema, { combine, createArrayValidator, isArrayValidator, refine, } from './createZodSchema.ts';
import type { RefineConstraint, ValidationOptionUnion, ValidationOptions } from './types.ts';
export * from './types.ts';
const pluginName = "zod";
export class PothosZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    inputFieldValidators = new Map<string, Record<string, zod.ZodType<unknown>>>();
    override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>): PothosInputFieldConfig<Types> {
        const fieldType = resolveInputTypeConfig(fieldConfig.type, this.buildCache);
        const validationOptions = fieldConfig.pothosOptions.validate as ValidationOptionUnion | undefined;
        if (!validationOptions && fieldType.kind !== "InputObject") {
            return fieldConfig;
        }
        const fieldName = fieldConfig.kind === "Arg"
            ? `${fieldConfig.parentType}.${fieldConfig.parentField}(${fieldConfig.name})`
            : `${fieldConfig.parentType}.${fieldConfig.name}`;
        const validator = this.createValidator(validationOptions, fieldConfig.type, fieldName);
        if (fieldConfig.kind === "Arg") {
            return {
                ...fieldConfig,
                extensions: {
                    ...fieldConfig.extensions,
                    validator,
                },
            };
        }
        this.inputFieldValidators.set(fieldConfig.parentType, {
            ...this.inputFieldValidators.get(fieldConfig.parentType),
            [fieldConfig.name]: validator,
        });
        return fieldConfig;
    }
    private mappingCache = new Map<string, InputTypeFieldsMapping<Types, zod.ZodType<unknown>>>();
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        // Only used to check if validation is required
        const argMap = mapInputFields(fieldConfig.args, this.buildCache, (field) => field.extensions?.validator ?? null, this.mappingCache);
        if (!argMap && !fieldConfig.pothosOptions.validate) {
            return resolver;
        }
        const args: Record<string, zod.ZodType<unknown>> = {};
        for (const [argName, arg] of Object.entries(fieldConfig.args)) {
            const validator = arg.extensions?.validator as zod.ZodType<unknown> | undefined;
            if (validator) {
                args[argName] = validator;
            }
        }
        let validator: zod.ZodTypeAny = zod.object(args).passthrough();
        if (fieldConfig.pothosOptions.validate) {
            validator = refine(validator, fieldConfig.pothosOptions.validate as ValidationOptionUnion);
        }
        const validationError = this.builder.options.zod?.validationError;
        const validatorWithErrorHandling = validationError &&
            async function validate(value: unknown, ctx: object, info: GraphQLResolveInfo) {
                try {
                    const result: unknown = await validator.parseAsync(value);
                    return result;
                }
                catch (error: unknown) {
                    const errorOrMessage = validationError(error as zod.ZodError, value as Record<string, unknown>, ctx, info);
                    if (typeof errorOrMessage === "string") {
                        throw new PothosValidationError(errorOrMessage);
                    }
                    throw errorOrMessage;
                }
            };
        return async (parent, rawArgs, context, info) => resolver(parent, (await (validatorWithErrorHandling
            ? validatorWithErrorHandling(rawArgs, context, info)
            : validator.parseAsync(rawArgs))) as object, context, info);
    }
    createValidator(optionsOrConstraint: RefineConstraint | ValidationOptionUnion | undefined, type: PothosInputFieldType<Types> | null, fieldName: string): zod.ZodTypeAny {
        const options: ValidationOptionUnion | undefined = Array.isArray(optionsOrConstraint) || typeof optionsOrConstraint === "function"
            ? { refine: optionsOrConstraint }
            : optionsOrConstraint;
        if (type?.kind === "InputObject") {
            const typeConfig = this.buildCache.getTypeConfig(type.ref, "InputObject");
            let fieldValidator = refine(zod.lazy(() => zod.object(this.inputFieldValidators.get(typeConfig.name) ?? {}).passthrough()), options);
            if (typeConfig.pothosOptions.validate) {
                fieldValidator = refine(fieldValidator, typeConfig.pothosOptions.validate as ValidationOptions<unknown>);
            }
            return combine([fieldValidator], type.required);
        }
        if (type?.kind === "List") {
            if (options && !isArrayValidator(options)) {
                throw new PothosSchemaError(`Expected valid array validator for ${fieldName}`);
            }
            const items = this.createValidator(options?.items, type.type, fieldName);
            if (options) {
                return combine([createArrayValidator(options, items)], type.required);
            }
            return combine([items.array()], type.required);
        }
        if (!options) {
            return zod.unknown();
        }
        return createZodSchema(options, !type || type.required);
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosZodPlugin, {
    v3(options) {
        return {
            validationOptions: undefined,
            zod: options.validationOptions,
        };
    },
});
export default pluginName;
export { default as createZodSchema } from './createZodSchema.ts';
