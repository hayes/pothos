import SchemaBuilder, { SchemaTypes } from '@giraphql/core';

function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

schemaBuilderProto.withInput = function withInput(inputOptions) {
  return {
    queryField: (fieldName, fieldOptions) => {
      const { argName = 'input', name: typeName = `${capitalize(fieldName)}Input` } = inputOptions;
      const inputRef = this.inputType(typeName, inputOptions);

      this.queryField(fieldName, (t) =>
        t.field({
          ...fieldOptions,
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          args: {
            [argName]: t.arg({
              required: true,
              type: inputRef,
            }),
          } as never,
        }),
      );
    },
  };
};
