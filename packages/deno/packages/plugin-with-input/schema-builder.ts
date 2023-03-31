// @ts-nocheck
import { InputFieldBuilder, RootFieldBuilder, SchemaTypes } from '../core/index.ts';
const rootBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown>;
function capitalize(s: string) {
    return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
function defaultGetName({ parentTypeName, fieldName, }: {
    parentTypeName: string;
    fieldName: string;
}) {
    return `${parentTypeName}${capitalize(fieldName)}Input`;
}
rootBuilderProto.fieldWithInput = function fieldWithInput({ typeOptions: { name: typeName, ...typeOptions } = {}, argOptions: { name: argName = "input", ...argOptions } = {}, args, input, ...fieldOptions }) {
    const inputRef = this.builder.inputRef(typeName ?? `UnnamedWithInput`);
    const fieldRef = this.field({
        args: {
            ...args,
            [argName]: this.arg({
                required: true,
                ...this.builder.options.withInput?.argOptions,
                ...(argOptions as {}),
                type: inputRef,
            }),
        },
        ...fieldOptions,
    } as never);
    fieldRef.onFirstUse((config) => {
        const { name: getTypeName = defaultGetName, ...defaultTypeOptions } = this.builder.options.withInput?.typeOptions ?? {};
        const name = typeName ?? getTypeName({ parentTypeName: config.parentType, fieldName: config.name });
        inputRef.name = name;
        this.builder.inputType(inputRef, {
            fields: () => input,
            ...defaultTypeOptions,
            ...typeOptions,
        } as never);
    });
    return fieldRef;
};
Object.defineProperty(rootBuilderProto, "input", {
    get: function getInputBuilder(this: RootFieldBuilder<SchemaTypes, unknown>) {
        return new InputFieldBuilder(this.builder, "InputObject", `UnnamedWithInput`);
    },
});
