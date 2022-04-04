import { InputFieldBuilder, RootFieldBuilder, SchemaTypes } from '@pothos/core';

const rootBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown
>;

function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

rootBuilderProto.fieldWithInput = function fieldWithInput({
  typeOptions: { name: typeName, ...typeOptions } = {},
  argOptions,
  args,
  input,
  ...fieldOptions
}) {
  const inputRef = this.builder.inputRef(typeName ?? `UnnamedWithInputOn${this.typename}`);

  const fieldRef = this.field({
    args: {
      ...args,
      [argOptions?.name ?? 'input']: this.arg({
        required: true,
        ...this.builder.options.withInput?.argOptions,
        type: inputRef,
      }),
    },
    ...fieldOptions,
  } as never);

  this.builder.configStore.onFieldUse(fieldRef, (config) => {
    const name = typeName ?? `${this.typename}${capitalize(config.name)}Input`;

    this.builder.inputType(name, {
      fields: () => input,
      ...this.builder.options.withInput?.typeOptions,
      ...typeOptions,
    });

    this.builder.configStore.associateRefWithName(inputRef, name);
  });

  return fieldRef;
};

Object.defineProperty(rootBuilderProto, 'input', {
  get: function getInputBuilder(this: RootFieldBuilder<SchemaTypes, unknown>) {
    return new InputFieldBuilder(this.builder, 'InputObject', `UnnamedWithInputOn${this.typename}`);
  },
});
