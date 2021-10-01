import SchemaBuilder, { SchemaTypes } from '@giraphql/core';
import { WithInputBuilders } from './types';

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

type DefaultBuilders = Pick<
  GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>,
  keyof WithInputBuilders<SchemaTypes, {}, string>
>;

schemaBuilderProto.withInput2 = function withInput2(inputOptions) {
  return new Proxy(schemaBuilderProto, {
    get:
      (_target, prop: keyof DefaultBuilders) =>
      (fieldName: string, fieldOptions: GiraphQLSchemaTypes.FieldOptions) => {
        const { argName = 'input', name: typeName = `${capitalize(fieldName)}Input` } =
          inputOptions;
        const inputRef = this.inputType(typeName, inputOptions);

        (this as never as DefaultBuilders)[prop](
          fieldName,
          (t: GiraphQLSchemaTypes.RootFieldBuilder<SchemaTypes, unknown>) =>
            t.field({
              ...fieldOptions,
              args: {
                [argName]: t.arg({
                  required: true,
                  type: inputRef,
                }),
              },
            }),
        );
      },
  });
};
