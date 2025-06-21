import './global-types.js';
import './methods.js';
import SchemaBuilder, { BasePlugin, mapInputFields, unwrapInputFieldType } from '@pothos/core';
import { createArgsValidator } from './utils.js';
export * from './types.js';
const pluginName = "validation";
export class PothosZodPlugin extends BasePlugin {
    onInputFieldConfig(fieldConfig) {
        if (fieldConfig.pothosOptions.validate) {
            var _fieldConfig_extensions;
            const extensions = (_fieldConfig_extensions = fieldConfig.extensions) !== null && _fieldConfig_extensions !== void 0 ? _fieldConfig_extensions : {};
            var _extensions_validationSchemas;
            return {
                ...fieldConfig,
                extensions: {
                    ...extensions,
                    validationSchemas: [
                        ...(_extensions_validationSchemas = extensions.validationSchemas) !== null && _extensions_validationSchemas !== void 0 ? _extensions_validationSchemas : [],
                        fieldConfig.pothosOptions.validate
                    ]
                }
            };
        }
        return fieldConfig;
    }
    onOutputFieldConfig(fieldConfig) {
        var _fieldConfig_pothosOptions_validate;
        const argsSchema = (_fieldConfig_pothosOptions_validate = fieldConfig.pothosOptions.validate) !== null && _fieldConfig_pothosOptions_validate !== void 0 ? _fieldConfig_pothosOptions_validate : null;
        const argMappings = mapInputFields(fieldConfig.args, this.buildCache, (field) => {
            var _field_extensions, _this_buildCache_getTypeConfig_extensions;
            var _field_extensions_validationSchemas;
            const fieldSchemas = (_field_extensions_validationSchemas = (_field_extensions = field.extensions) === null || _field_extensions === void 0 ? void 0 : _field_extensions.validationSchemas) !== null && _field_extensions_validationSchemas !== void 0 ? _field_extensions_validationSchemas : null;
            const fieldTypeName = unwrapInputFieldType(field.type);
            var _this_buildCache_getTypeConfig_extensions_validationSchemas;
            const typeSchemas = (_this_buildCache_getTypeConfig_extensions_validationSchemas = (_this_buildCache_getTypeConfig_extensions = this.buildCache.getTypeConfig(fieldTypeName).extensions) === null || _this_buildCache_getTypeConfig_extensions === void 0 ? void 0 : _this_buildCache_getTypeConfig_extensions.validationSchemas) !== null && _this_buildCache_getTypeConfig_extensions_validationSchemas !== void 0 ? _this_buildCache_getTypeConfig_extensions_validationSchemas : null;
            return fieldSchemas || typeSchemas ? {
                fieldSchemas,
                typeSchemas
            } : null;
        });
        if (!argMappings && !argsSchema) {
            return fieldConfig;
        }
        const argValidator = createArgsValidator(argMappings, argsSchema);
        var _fieldConfig_argMappers;
        return {
            ...fieldConfig,
            argMappers: [
                ...(_fieldConfig_argMappers = fieldConfig.argMappers) !== null && _fieldConfig_argMappers !== void 0 ? _fieldConfig_argMappers : [],
                (args) => argValidator(args)
            ]
        };
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosZodPlugin);
export default pluginName;
//# sourceMappingURL=index.js.map
