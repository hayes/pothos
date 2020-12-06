import { SchemaTypes, GiraphQLOutputFieldConfig, BaseFieldWrapper } from '@giraphql/core';

export class ZodFieldWrapper<Types extends SchemaTypes> extends BaseFieldWrapper<Types> {
  constructor(field: GiraphQLOutputFieldConfig<Types>) {
    super(field, 'GiraphQLZod');
  }

  validate(args: object) {
    const schema = this.field.giraphqlOptions.zodSchema;

    if (schema) {
      schema.parse(args);
    }
  }

  beforeResolve(
    requestData: {},
    parentData: {},
    parent: unknown,
    args: object,
    context: Types['Context'],
  ) {
    this.validate(args);

    return {};
  }

  beforeSubscribe(requestData: {}, parent: unknown, args: object, context: Types['Context']) {
    this.validate(args);

    return {};
  }
}
