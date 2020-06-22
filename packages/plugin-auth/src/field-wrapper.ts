import {
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  BaseFieldWrapper,
  GiraphQLObjectTypeConfig,
} from '@giraphql/core';
import {
  AuthPluginOptions,
  AuthRequestData,
  GrantPermissions,
  ResolveChecksForType,
  PermissionCheckMap,
  PermissionCheck,
} from './types';
import { AuthMeta, GrantMap } from '.';
import { checkFieldPermissions } from './check-field-permissions';
import runPostResolveChecks from './post-resolve-check';
import runPreResolveChecks from './pre-resolve-checks';
import { getResolveChecks, getPermissionCheckers, getPermissionCheck } from './create-field-data';

export class AuthFieldWrapper<Types extends SchemaTypes> extends BaseFieldWrapper<
  Types,
  AuthRequestData,
  AuthMeta
> {
  returnTyeConfig: GiraphQLTypeConfig;

  grantPermissions: GrantPermissions<Types, unknown, {}> | null;

  resolveChecks: ResolveChecksForType;

  permissionCheckers: PermissionCheckMap<Types, unknown>;

  permissionCheck: PermissionCheck<Types, unknown, {}>;

  requirePermissionChecks: boolean;

  fieldName: string;

  private runPreResolveChecks = runPreResolveChecks;

  private runPostResolveChecks = runPostResolveChecks;

  private checkFieldPermissions = checkFieldPermissions;

  constructor(
    field: GiraphQLOutputFieldConfig<Types>,
    options: Required<AuthPluginOptions>,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ) {
    super(field, 'GiraphQLAuth');

    const returnType = field.type;
    this.returnTyeConfig = builder.configStore.getTypeConfig(
      returnType.kind === 'List' ? returnType.type.ref : returnType.ref,
    );

    this.grantPermissions =
      (this.field.options.grantPermissions as GrantPermissions<Types, unknown, {}>) ?? null;

    this.resolveChecks = getResolveChecks(this.returnTyeConfig.name, builder, options);
    this.permissionCheckers = getPermissionCheckers(field, builder);
    this.permissionCheck = getPermissionCheck(field, builder, options);

    this.requirePermissionChecks = options.requirePermissionChecks;

    this.fieldName = `${this.field.parentType}.${this.field.name}`;
  }

  createRequestData() {
    return {
      preResolveAuthCheckCache: new Map(),
    };
  }

  async beforeResolve(
    requestData: AuthRequestData,
    parentData: AuthMeta | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
  ) {
    const parentMeta = parentData || new AuthMeta();

    if (this.field.parentType === 'Subscription') {
      return {
        onWrap: (child: unknown): Promise<AuthMeta> => {
          const childMeta = new AuthMeta(parentMeta.grantedPermissions.clone(), parentMeta);

          return this.runPostResolveChecks(this.returnTyeConfig, childMeta, child, context);
        },
      };
    }

    await this.checkFieldPermissions(parentMeta, parent, args, context);

    const newGrants: GrantMap = await this.runPreResolveChecks(requestData, context);

    if (this.grantPermissions) {
      const grants =
        typeof this.grantPermissions === 'function'
          ? await this.grantPermissions(parent, args, context)
          : this.grantPermissions;

      newGrants.mergeSharedGrants(grants);
    }

    return {
      onChild: async (
        child: unknown,
        index: number | null,
        type: GiraphQLObjectTypeConfig,
      ): Promise<AuthMeta> => {
        const childMeta = new AuthMeta(newGrants, parentMeta);

        if (type.name !== this.returnTyeConfig.name) {
          await this.runPostResolveChecks(this.returnTyeConfig, childMeta, child, context);
        }

        await this.runPostResolveChecks(type, childMeta, child, context);

        return childMeta;
      },
    };
  }

  async beforeSubscribe(
    requestData: AuthRequestData,
    parent: unknown,
    args: object,
    context: Types['Context'],
  ) {
    const parentMeta = new AuthMeta();

    await this.checkFieldPermissions(parentMeta, parent, args, context);

    const newGrants = await this.runPreResolveChecks(requestData, context);

    if (this.grantPermissions) {
      const grants =
        typeof this.grantPermissions === 'function'
          ? await this.grantPermissions(parent, args, context)
          : this.grantPermissions;

      newGrants.mergeSharedGrants(grants);
    }

    return {
      onValue(child: unknown): AuthMeta {
        return new AuthMeta(newGrants);
      },
    };
  }
}
