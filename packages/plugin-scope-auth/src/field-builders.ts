import { type FieldKind, RootFieldBuilder, type SchemaTypes } from '@pothos/core';

export const WITH_AUTH_SCOPES_EXTENSION = 'pothosWithAuthScopes';

const rootFieldBuilder = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
> & {
  withAuth: (scopes: unknown) => unknown;
};

rootFieldBuilder.withAuth = function withAuth(scopes) {
  return addScopes(scopes, this as never, this.clone() as never);
};

function addScopes(
  scopes: unknown,
  parent: { createField: (options: Record<string, unknown>) => unknown },
  builder: { createField: (options: Record<string, unknown>) => unknown },
) {
  builder.createField = function createField(options) {
    const extensions = (options.extensions ?? {}) as Record<string, unknown>;

    return parent.createField.call(this, {
      ...options,
      extensions: {
        ...extensions,
        [WITH_AUTH_SCOPES_EXTENSION]: [
          scopes,
          ...((extensions[WITH_AUTH_SCOPES_EXTENSION] as unknown[] | undefined) ?? []),
        ],
      },
    });
  };

  return builder as never;
}
