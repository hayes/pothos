import {
  InterfaceFieldBuilder,
  MutationFieldBuilder,
  ObjectFieldBuilder,
  QueryFieldBuilder,
  SchemaTypes,
  SubscriptionFieldBuilder,
} from '@pothos/core';

const objectFieldBuilder = ObjectFieldBuilder.prototype as PothosSchemaTypes.ObjectFieldBuilder<
  SchemaTypes,
  {}
>;

objectFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new ObjectFieldBuilder(this.builder) as never);
};

const interfaceFieldBuilder =
  InterfaceFieldBuilder.prototype as PothosSchemaTypes.InterfaceFieldBuilder<SchemaTypes, {}>;

interfaceFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new InterfaceFieldBuilder(this.builder) as never);
};

const queryFieldBuilder = QueryFieldBuilder.prototype as PothosSchemaTypes.QueryFieldBuilder<
  SchemaTypes,
  {}
>;

queryFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new QueryFieldBuilder(this.builder) as never);
};

const mutationFieldBuilder =
  MutationFieldBuilder.prototype as PothosSchemaTypes.MutationFieldBuilder<SchemaTypes, {}>;

mutationFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new MutationFieldBuilder(this.builder) as never);
};

const subscriptionFieldBuilder =
  SubscriptionFieldBuilder.prototype as PothosSchemaTypes.SubscriptionFieldBuilder<SchemaTypes, {}>;

subscriptionFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, new SubscriptionFieldBuilder(this.builder) as never);
};

function addScopes(
  scopes: unknown,
  builder: { createField: (options: Record<string, unknown>) => unknown },
) {
  const originalCreateField = builder.createField;

  // eslint-disable-next-line no-param-reassign
  builder.createField = function createField(options) {
    return originalCreateField.call(this, {
      authScopes: scopes,
      ...options,
    });
  };

  return builder as never;
}
