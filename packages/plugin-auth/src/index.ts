import SchemaBuilder, { BasePlugin, SchemaTypes, GiraphQLOutputFieldConfig } from '@giraphql/core';
import './global-types';
import { AuthPluginOptions } from './types';
import AuthMeta from './auth-meta';
import GrantMap, { GrantedPermissions } from './grant-map';
import { AuthFieldWrapper } from './field-wrapper';

export { AuthMeta, GrantMap, GrantedPermissions };

export * from './types';

export default class AuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  name: 'GiraphQLAuth' = 'GiraphQLAuth';

  options: Required<AuthPluginOptions>;

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'GiraphQLAuth');

    const authOptions = builder.options.authOptions || {};

    this.options = {
      requirePermissionChecks: authOptions.requirePermissionChecks ?? true,
      explicitMutationChecks: authOptions.explicitMutationChecks ?? true,
      skipPreResolveOnInterfaces: authOptions.skipPreResolveOnInterfaces ?? false,
      skipPreResolveOnUnions: authOptions.skipPreResolveOnUnions ?? false,
    };
  }

  wrapOutputField(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    return new AuthFieldWrapper(fieldConfig, this.options, this.builder);
  }
}

SchemaBuilder.registerPlugin('GiraphQLAuth', AuthPlugin);
