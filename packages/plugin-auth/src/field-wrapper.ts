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
import ValueOrPromise from './utils/value-or-promise';

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
      (this.field.giraphqlOptions.grantPermissions as GrantPermissions<Types, unknown, {}>) ?? null;

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

  beforeResolve(
    requestData: AuthRequestData,
    parentData: AuthMeta | null,
    parent: unknown,
    args: object,
    context: Types['Context'],
  ) {
    const parentMeta = parentData || new AuthMeta();

    if (this.field.parentType === 'Subscription') {
      return {
        onChild: (child: unknown): AuthMeta | Promise<AuthMeta> => {
          const childMeta = new AuthMeta(parentMeta.grantedPermissions.clone(), parentMeta);

          return this.runPostResolveChecks(this.returnTyeConfig, childMeta, child, context)
            .nowOrThen(() => childMeta)
            .toValueOrPromise();
        },
      };
    }

    let newGrantsValueOrPromise: ValueOrPromise<GrantMap> = new ValueOrPromise(
      this.checkFieldPermissions(parentMeta, parent, args, context),
    ).nowOrThen(() => this.runPreResolveChecks(requestData, context));

    if (this.grantPermissions) {
      newGrantsValueOrPromise = newGrantsValueOrPromise.nowOrThen((newGrants) =>
        new ValueOrPromise(
          typeof this.grantPermissions === 'function'
            ? this.grantPermissions(parent, args, context)
            : this.grantPermissions!,
        ).nowOrThen((grants) => newGrants.mergeSharedGrants(grants)),
      );
    }

    return newGrantsValueOrPromise
      .nowOrThen((newGrants) => ({
        onChild: (
          child: unknown,
          index: number | null,
          type: GiraphQLObjectTypeConfig,
        ): AuthMeta | Promise<AuthMeta> => {
          const childMeta = new AuthMeta(newGrants, parentMeta);

          if (type.name !== this.returnTyeConfig.name) {
            return this.runPostResolveChecks(this.returnTyeConfig, childMeta, child, context)
              .nowOrThen(() => this.runPostResolveChecks(type, childMeta, child, context))
              .nowOrThen(() => childMeta)
              .toValueOrPromise();
          }

          return this.runPostResolveChecks(type, childMeta, child, context)
            .nowOrThen(() => childMeta)
            .toValueOrPromise();
        },
      }))
      .toValueOrPromise();
  }

  beforeSubscribe(
    requestData: AuthRequestData,
    parent: unknown,
    args: object,
    context: Types['Context'],
  ) {
    const parentMeta = new AuthMeta();

    let newGrantsValueOrPromise: ValueOrPromise<GrantMap> = new ValueOrPromise(
      this.checkFieldPermissions(parentMeta, parent, args, context),
    ).nowOrThen(() => this.runPreResolveChecks(requestData, context));

    if (this.grantPermissions) {
      newGrantsValueOrPromise = newGrantsValueOrPromise.nowOrThen((newGrants) =>
        new ValueOrPromise(
          typeof this.grantPermissions === 'function'
            ? this.grantPermissions(parent, args, context)
            : this.grantPermissions!,
        ).nowOrThen((grants) => newGrants.mergeSharedGrants(grants)),
      );
    }

    return newGrantsValueOrPromise
      .nowOrThen((newGrants) => ({
        onValue(child: unknown): AuthMeta {
          return new AuthMeta(newGrants);
        },
      }))
      .toValueOrPromise();
  }
}
