import {
  extendFieldBuilder,
  type FieldKind,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { FieldAuthScopes } from './types.js';

export const WITH_AUTH_SCOPES_EXTENSION = 'pothosWithAuthScopes';

type AnyFieldAuthScopes = FieldAuthScopes<SchemaTypes, {}, {}>;
type AnyRootFieldBuilder = PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;

const rootFieldBuilder = RootFieldBuilder.prototype as AnyRootFieldBuilder & {
  withAuth: (scopes: AnyFieldAuthScopes) => AnyRootFieldBuilder;
};

rootFieldBuilder.withAuth = function withAuth(scopes) {
  return extendFieldBuilder(this, (options) => {
    const extensions = (options.extensions ?? {}) as {
      [WITH_AUTH_SCOPES_EXTENSION]?: AnyFieldAuthScopes[];
    };

    return {
      ...options,
      extensions: {
        ...extensions,
        [WITH_AUTH_SCOPES_EXTENSION]: [scopes, ...(extensions[WITH_AUTH_SCOPES_EXTENSION] ?? [])],
      },
    };
  });
};
