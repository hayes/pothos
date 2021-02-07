import SchemaBuilder, {
  BasePlugin,
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  BuildCache,
} from '@giraphql/core';
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

  constructor(buildCache: BuildCache<Types>) {
    super(buildCache, 'GiraphQLAuth');

    const authOptions = this.builder.options.authOptions || {};

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
