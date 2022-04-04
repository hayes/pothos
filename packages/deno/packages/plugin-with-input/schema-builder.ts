// @ts-nocheck
import SchemaBuilder, { SchemaTypes } from '../core/index.ts';
const schemaBuilderProto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;
function capitalize(s: string) {
    return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
schemaBuilderProto.queryFieldWithInput = function queryFieldWithInput(fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, fieldOptions) {
    const { withInput: { inputArgOptions }, } = this.options;
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: inputFields,
    });
    this.queryField(fieldName, (t) => t.field({
        ...fieldOptions,
        args: {
            [argName]: t.arg({ ...(inputArgOptions as {}), type: inputRef, required: true }),
        },
    } as never));
};
schemaBuilderProto.mutationFieldWithInput = function mutationFieldWithInput(fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, fieldOptions) {
    const { withInput: { inputArgOptions }, } = this.options;
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: inputFields,
    });
    this.mutationField(fieldName, (t) => t.field({
        ...fieldOptions,
        args: {
            [argName]: t.arg({ ...(inputArgOptions as {}), type: inputRef, required: true }),
        },
    } as never));
};
schemaBuilderProto.subscriptionFieldWithInput = function subscriptionFieldWithInput(fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, fieldOptions) {
    const { withInput: { inputArgOptions }, } = this.options;
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: inputFields,
    });
    this.subscriptionField(fieldName, (t) => t.field({
        ...fieldOptions,
        args: {
            [argName]: t.arg({ ...(inputArgOptions as {}), type: inputRef, required: true }),
        },
    } as never));
};
schemaBuilderProto.objectFieldWithInput = function objectFieldWithInput(ref, fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, fieldOptions) {
    const { withInput: { inputArgOptions }, } = this.options;
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: inputFields,
    });
    this.objectField(ref, fieldName, (t) => t.field({
        ...fieldOptions,
        args: {
            [argName]: t.arg({ ...(inputArgOptions as {}), type: inputRef, required: true }),
        },
    } as never));
};
schemaBuilderProto.interfaceFieldWithInput = function interfaceFieldWithInput(ref, fieldName, { name: inputName = `${capitalize(fieldName)}Input`, argName = "input", inputFields, ...inputOptions }, fieldOptions) {
    const { withInput: { inputArgOptions }, } = this.options;
    const inputRef = this.inputType(inputName, {
        ...inputOptions,
        fields: inputFields,
    });
    this.interfaceField(ref, fieldName, (t) => t.field({
        ...fieldOptions,
        args: {
            [argName]: t.arg({ ...(inputArgOptions as {}), type: inputRef, required: true }),
        },
    } as never));
};
