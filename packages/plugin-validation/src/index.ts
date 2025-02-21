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
} from '@pothos/core';
import type { StandardSchemaV1 } from './standard-schema';

export * from './types';

const pluginName = 'validation';

(RootFieldBuilder.prototype as RootFieldBuilder<SchemaTypes, unknown>).validate = function validate<
  Args extends InputFieldMap,
  R,
>(args: Args, _schema: StandardSchemaV1<unknown, R>) {
  return args as never;
};

(FieldRef.prototype as FieldRef<SchemaTypes>).validate = function validate() {
  return this as never;
};

(InputFieldRef.prototype as InputFieldRef<SchemaTypes, unknown>).validate = function validate() {
  return this as never;
};

(ArgumentRef.prototype as ArgumentRef<SchemaTypes, unknown>).validate = function validate() {
  return this as never;
};

(InputObjectRef.prototype as InputObjectRef<SchemaTypes, unknown>).validate = function validate() {
  return this as never;
};

export class PothosZodPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> {
    return fieldConfig;
  }

  // override wrapResolve(
  //   resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
  //   fieldConfig: PothosOutputFieldConfig<Types>,
  // ): GraphQLFieldResolver<unknown, Types['Context'], object> {
  //   // Only used to check if validation is required
  //   const argMap = mapInputFields(
  //     fieldConfig.args,
  //     this.buildCache,
  //     (field) => field.extensions?.validator ?? null,
  //   );

  //   if (!argMap && !fieldConfig.pothosOptions.validate) {
  //     return resolver;
  //   }

  //   const args: Record<string, zod.ZodType<unknown>> = {};

  //   for (const [argName, arg] of Object.entries(fieldConfig.args)) {
  //     const validator = arg.extensions?.validator as zod.ZodType<unknown> | undefined;

  //     if (validator) {
  //       args[argName] = validator;
  //     }
  //   }

  //   let validator: zod.ZodTypeAny = zod.object(args).passthrough();

  //   if (fieldConfig.pothosOptions.validate) {
  //     validator = refine(validator, fieldConfig.pothosOptions.validate as ValidationOptionUnion);
  //   }

  //   const validationError = this.builder.options.zod?.validationError;

  //   const validatorWithErrorHandling R extends any
  //     validationError &&
  //     async function validate(value: unknown, ctx: object, info: GraphQLResolveInfo) {
  //       try {
  //         const result: unknown = await validator.parseAsync(value);

  //         return result;
  //       } catch (error: unknown) {
  //         const errorOrMessage = validationError(
  //           error as zod.ZodError,
  //           value as Record<string, unknown>,
  //           ctx,
  //           info,
  //         );

  //         if (typeof errorOrMessage === 'string') {
  //           throw new PothosValidationError(errorOrMessage);
  //         }

  //         throw errorOrMessage;
  //       }
  //     };

  //   return async (parent, rawArgs, context, info) =>
  //     resolver(
  //       parent,
  //       (await (validatorWithErrorHandling
  //         ? validatorWithErrorHandling(rawArgs, context, info)
  //         : validator.parseAsync(rawArgs))) as object,
  //       context,
  //       info,
  //     );
  // }
}

SchemaBuilder.registerPlugin(pluginName, PothosZodPlugin);

export default pluginName;
