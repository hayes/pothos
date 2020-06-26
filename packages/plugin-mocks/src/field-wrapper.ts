import {
  SchemaTypes,
  BaseFieldWrapper,
  GiraphQLOutputFieldConfig,
  Resolver,
  Subscriber,
} from '@giraphql/core';

export class MocksFieldWrapper<Types extends SchemaTypes> extends BaseFieldWrapper<Types, {}, {}> {
  resolver: Resolver<unknown, {}, Types['Context'], unknown> | null;
  subscriber: Subscriber<unknown, {}, Types['Context'], unknown> | null;

  constructor(
    field: GiraphQLOutputFieldConfig<Types>,
    resolver: Resolver<unknown, {}, Types['Context'], unknown> | null,
    subscriber: Subscriber<unknown, {}, Types['Context'], unknown> | null,
  ) {
    super(field, 'GiraphQLMocks');

    this.resolver = resolver;
    this.subscriber = subscriber;
  }

  beforeResolve() {
    return {
      overwriteResolve: this.resolver || undefined,
    };
  }

  beforeSubscribe() {
    return {
      overwriteSubscribe: this.subscriber || undefined,
    };
  }
}
