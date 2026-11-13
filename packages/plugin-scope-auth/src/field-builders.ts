import {
  InterfaceFieldBuilder,
  MutationFieldBuilder,
  ObjectFieldBuilder,
  QueryFieldBuilder,
  type SchemaTypes,
  SubscriptionFieldBuilder,
} from '@pothos/core';

const objectFieldBuilder = ObjectFieldBuilder.prototype as PothosSchemaTypes.ObjectFieldBuilder<
  SchemaTypes,
  {}
>;

objectFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new ObjectFieldBuilder(this.builder) as never, this as never);
};

const interfaceFieldBuilder =
  InterfaceFieldBuilder.prototype as PothosSchemaTypes.InterfaceFieldBuilder<SchemaTypes, {}>;

interfaceFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new InterfaceFieldBuilder(this.builder) as never, this as never);
};

const queryFieldBuilder = QueryFieldBuilder.prototype as PothosSchemaTypes.QueryFieldBuilder<
  SchemaTypes,
  {}
>;

queryFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new QueryFieldBuilder(this.builder) as never, this as never);
};

const mutationFieldBuilder =
  MutationFieldBuilder.prototype as PothosSchemaTypes.MutationFieldBuilder<SchemaTypes, {}>;

mutationFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new MutationFieldBuilder(this.builder) as never, this as never);
};

const subscriptionFieldBuilder =
  SubscriptionFieldBuilder.prototype as PothosSchemaTypes.SubscriptionFieldBuilder<SchemaTypes, {}>;

subscriptionFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new SubscriptionFieldBuilder(this.builder) as never, this as never);
};

function addScopes(
  scopes: unknown,
  builder: { createField: (options: Record<string, unknown>) => unknown },
  parent?: { createField: (options: Record<string, unknown>) => unknown },
) {
  const originalCreateField = parent?.createField ?? builder.createField;

  builder.createField = function createField(options) {
    // Keep each `withAuth` call separate so the field's own `authScopes` option
    // can run alongside them instead of overwriting the scopes from `withAuth`.
    return originalCreateField.call(this, {
      ...options,
      withAuthScopes: [...((options.withAuthScopes as unknown[] | undefined) ?? []), scopes],
    });
  };

  return builder as never;
}
