import { ArgumentRef, FieldRef, InputFieldRef, InputObjectRef, RootFieldBuilder } from '@pothos/core';
RootFieldBuilder.prototype.validate = function validate(args, _schema) {
    return args;
};
FieldRef.prototype.validate = function validate(schema) {
    this.updateConfig((config) => {
        var _config_extensions;
        const extensions = (_config_extensions = config.extensions) !== null && _config_extensions !== void 0 ? _config_extensions : {};
        return {
            ...config,
            extensions: {
                ...extensions,
                validationSchemas: extensions.validationSchemas ? [
                    schema,
                    ...extensions.validationSchemas
                ] : [
                    schema
                ]
            }
        };
    });
    return this;
};
InputFieldRef.prototype.validate = function validate(schema) {
    this.updateConfig((config) => {
        var _config_extensions;
        const extensions = (_config_extensions = config.extensions) !== null && _config_extensions !== void 0 ? _config_extensions : {};
        return {
            ...config,
            extensions: {
                ...extensions,
                validationSchemas: extensions.validationSchemas ? [
                    schema,
                    ...extensions.validationSchemas
                ] : [
                    schema
                ]
            }
        };
    });
    return this;
};
ArgumentRef.prototype.validate = function validate(schema) {
    this.updateConfig((config) => {
        var _config_extensions;
        const extensions = (_config_extensions = config.extensions) !== null && _config_extensions !== void 0 ? _config_extensions : {};
        return {
            ...config,
            extensions: {
                ...extensions,
                validationSchemas: extensions.validationSchemas ? [
                    schema,
                    ...extensions.validationSchemas
                ] : [
                    schema
                ]
            }
        };
    });
    return this;
};
InputObjectRef.prototype.validate = function validate(schema) {
    this.updateConfig((config) => {
        var _config_extensions;
        const extensions = (_config_extensions = config.extensions) !== null && _config_extensions !== void 0 ? _config_extensions : {};
        return {
            ...config,
            extensions: {
                ...extensions,
                validationSchemas: extensions.validationSchemas ? [
                    schema,
                    ...extensions.validationSchemas
                ] : [
                    schema
                ]
            }
        };
    });
    return this;
};
//# sourceMappingURL=methods.js.map
