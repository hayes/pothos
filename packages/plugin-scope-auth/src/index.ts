import './global-types.js';
import './schema-builder.js';
import './field-builders.js';
import SchemaBuilder, {
  BasePlugin,
  type FieldKind,
  type PothosInterfaceTypeConfig,
  type PothosMutationTypeConfig,
  type PothosObjectTypeConfig,
  type PothosOutputFieldConfig,
  type PothosQueryTypeConfig,
  PothosSchemaError,
  type PothosSubscriptionTypeConfig,
  RootFieldBuilder,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLIsTypeOfFn, GraphQLTypeResolver } from 'graphql';
import { isTypeOfHelper } from './is-type-of-helper.js';
import RequestCache from './request-cache.js';
import { resolveHelper } from './resolve-helper.js';
import {
  createFieldAuthScopesStep,
  createFieldGrantScopesStep,
  createResolveStep,
  createTypeAuthScopesStep,
  createTypeGrantScopesStep,
  typeAuthScopesStepKey,
} from './steps.js';
import type { ResolveStep, TypeAuthScopes, TypeGrantScopes } from './types.js';

export * from './errors.js';
export * from './types.js';
export { RequestCache };

const pluginName = 'scopeAuth';

export default pluginName;

let inResolveType = false;
export class PothosScopeAuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (this.options.disableScopeAuth) {
      return resolver;
    }

    const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);

    if (typeConfig.graphqlKind !== 'Object' && typeConfig.graphqlKind !== 'Interface') {
      throw new PothosSchemaError(
        `Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`,
      );
    }

    const authorizedOnSubscribe =
      !!this.builder.options.scopeAuth?.authorizeOnSubscribe && typeConfig.kind === 'Subscription';

    // A field declared on an interface is inherited by every type that implements it, and
    // `fieldConfig.parentType` is always the declaring interface, never the concrete type the field
    // is being resolved on. Building the step list here would apply only the interface's policy and
    // silently skip the implementing type's `authScopes`/`grantScopes` (and the `authScopes` of the
    // other interfaces it implements). Instead dispatch on the concrete type at resolve time and
    // enforce both the interface's policy and the implementing type's policy.
    if (typeConfig.graphqlKind === 'Interface') {
      return this.createInheritedFieldResolver(
        resolver,
        fieldConfig,
        typeConfig,
        authorizedOnSubscribe,
      );
    }

    const steps = this.createResolveSteps(
      fieldConfig,
      typeConfig,
      resolver,
      this.runTypeScopesOnField(typeConfig),
      authorizedOnSubscribe,
    );

    if (steps.length > 1) {
      return resolveHelper(steps, this, fieldConfig);
    }

    return resolver;
  }

  /**
   * Returns a resolver that resolves the type policy from `info.parentType` (the concrete type the
   * field is being resolved on) rather than from the interface that declared the field.
   *
   * The resolver for each concrete type is built once, the first time a field is resolved on that
   * type, and memoized by type name.
   */
  createInheritedFieldResolver(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
    declaringTypeConfig: PothosInterfaceTypeConfig,
    authorizedOnSubscribe: boolean,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const resolversByType = new Map<
      string,
      GraphQLFieldResolver<unknown, Types['Context'], object>
    >();

    const resolverForType = (typeName: string) => {
      let cached = resolversByType.get(typeName);

      if (!cached) {
        const ownerTypeConfig = this.getOwnerTypeConfig(typeName, declaringTypeConfig);

        const steps = this.createResolveSteps(
          fieldConfig,
          declaringTypeConfig,
          resolver,
          this.runTypeScopesOnField(declaringTypeConfig),
          authorizedOnSubscribe,
          ownerTypeConfig,
        );

        cached = steps.length > 1 ? resolveHelper(steps, this, fieldConfig) : resolver;

        resolversByType.set(typeName, cached);
      }

      return cached;
    };

    return (parent, args, context, info) =>
      resolverForType(info.parentType.name)(parent, args, context, info);
  }

  /**
   * Resolves the config for the concrete type a field is being resolved on. Types that have no
   * Pothos config (types added to the schema outside of the builder) fall back to the declaring
   * interface, preserving the previous behavior rather than throwing at resolve time.
   */
  getOwnerTypeConfig(
    typeName: string,
    declaringTypeConfig: PothosInterfaceTypeConfig,
  ): PothosInterfaceTypeConfig | PothosObjectTypeConfig {
    if (typeName === declaringTypeConfig.name) {
      return declaringTypeConfig;
    }

    let config: PothosObjectTypeConfig | undefined;

    try {
      config = this.buildCache.getTypeConfig(typeName, 'Object');
    } catch {
      return declaringTypeConfig;
    }

    return config;
  }

  runTypeScopesOnField(
    typeConfig:
      | PothosInterfaceTypeConfig
      | PothosMutationTypeConfig
      | PothosObjectTypeConfig
      | PothosQueryTypeConfig
      | PothosSubscriptionTypeConfig,
  ) {
    const nonRoot =
      (typeConfig.graphqlKind === 'Interface' || typeConfig.graphqlKind === 'Object') &&
      typeConfig.kind !== 'Query' &&
      typeConfig.kind !== 'Mutation' &&
      typeConfig.kind !== 'Subscription';

    return (
      !nonRoot ||
      !(
        typeConfig.pothosOptions.runScopesOnType ??
        this.builder.options.scopeAuth?.runScopesOnType ??
        false
      )
    );
  }

  override wrapSubscribe(
    subscriber: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (this.options.disableScopeAuth) {
      return subscriber;
    }

    const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);

    if (typeConfig.graphqlKind !== 'Object' && typeConfig.graphqlKind !== 'Interface') {
      throw new PothosSchemaError(
        `Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`,
      );
    }

    if (
      !this.builder.options.scopeAuth?.authorizeOnSubscribe ||
      typeConfig.kind !== 'Subscription'
    ) {
      return subscriber;
    }

    const steps = this.createSubscribeSteps(fieldConfig, typeConfig, subscriber);

    if (steps.length > 1) {
      return resolveHelper(steps, this, fieldConfig);
    }

    return subscriber;
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    return (...args) => {
      inResolveType = true;

      try {
        return resolveType(...args);
      } finally {
        inResolveType = false;
      }
    };
  }

  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    if (this.options.disableScopeAuth) {
      return isTypeOf;
    }

    const shouldRunTypeScopes =
      typeConfig.pothosOptions.runScopesOnType ??
      this.builder.options.scopeAuth?.runScopesOnType ??
      false;

    if (!shouldRunTypeScopes) {
      return isTypeOf;
    }

    const steps = this.createStepsForType(typeConfig, { forField: false });

    if (steps.length === 0) {
      return isTypeOf;
    }

    const runSteps = isTypeOfHelper(steps, this, isTypeOf);

    return (source, context, info) => {
      if (inResolveType) {
        return isTypeOf?.(source, context, info) ?? false;
      }

      return runSteps(source, context, info);
    };
  }

  createStepsForType(
    typeConfig:
      | PothosInterfaceTypeConfig
      | PothosMutationTypeConfig
      | PothosObjectTypeConfig
      | PothosQueryTypeConfig
      | PothosSubscriptionTypeConfig,
    {
      skipTypeScopes,
      skipInterfaceScopes,
      forField,
    }: { skipTypeScopes?: boolean; skipInterfaceScopes?: boolean; forField: boolean },
  ) {
    const parentAuthScope = typeConfig.pothosOptions.authScopes;
    const parentGrantScopes = typeConfig.pothosOptions.grantScopes;

    const interfaceConfigs =
      typeConfig.kind === 'Object' || typeConfig.kind === 'Interface'
        ? typeConfig.interfaces.map((iface) => this.buildCache.getTypeConfig(iface, 'Interface'))
        : [];

    const steps: ResolveStep<Types>[] = [];

    if (parentAuthScope && !skipTypeScopes) {
      steps.push(
        createTypeAuthScopesStep(
          parentAuthScope as TypeAuthScopes<Types, unknown>,
          typeConfig.name,
        ),
      );
    }

    if (
      !skipInterfaceScopes &&
      !(typeConfig.kind === 'Object' && typeConfig.pothosOptions.skipInterfaceScopes)
    ) {
      for (const interfaceConfig of interfaceConfigs) {
        if (interfaceConfig.pothosOptions.authScopes) {
          steps.push(
            createTypeAuthScopesStep(
              interfaceConfig.pothosOptions.authScopes as TypeAuthScopes<Types, unknown>,
              interfaceConfig.name,
            ),
          );
        }
      }
    }

    if (parentGrantScopes) {
      steps.push(
        createTypeGrantScopesStep(
          parentGrantScopes as TypeGrantScopes<Types, unknown>,
          typeConfig.name,
          forField,
        ),
      );
    }

    return steps;
  }

  createResolveSteps(
    fieldConfig: PothosOutputFieldConfig<Types>,
    typeConfig:
      | PothosInterfaceTypeConfig
      | PothosMutationTypeConfig
      | PothosObjectTypeConfig
      | PothosQueryTypeConfig
      | PothosSubscriptionTypeConfig,
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    shouldRunTypeScopes: boolean,
    authorizedOnSubscribe: boolean,
    ownerTypeConfig?: PothosInterfaceTypeConfig | PothosObjectTypeConfig,
  ): ResolveStep<Types>[] {
    const skipScopeOptions = {
      skipTypeScopes:
        ((fieldConfig.graphqlKind === 'Interface' || fieldConfig.graphqlKind === 'Object') &&
          fieldConfig.pothosOptions.skipTypeScopes) ??
        false,
      skipInterfaceScopes:
        ((fieldConfig.graphqlKind === 'Interface' || fieldConfig.kind === 'Object') &&
          fieldConfig.pothosOptions.skipInterfaceScopes) ??
        false,
      forField: true,
    };

    const inherited = !!ownerTypeConfig && ownerTypeConfig !== typeConfig;

    // On an inherited field the declaring interface's `authScopes` is an interface check, even
    // though it arrives as the `typeConfig`'s own scope. `skipInterfaceScopes` opts out of it,
    // using the same rule as a non-inherited field on an object that implements interfaces
    // (`createStepsForType` below): either the field option or the concrete type's option.
    const skipDeclaringInterfaceScopes =
      inherited &&
      (skipScopeOptions.skipInterfaceScopes ||
        (ownerTypeConfig.kind === 'Object' && !!ownerTypeConfig.pothosOptions.skipInterfaceScopes));

    const stepsForType: ResolveStep<Types>[] = [];

    if (!authorizedOnSubscribe) {
      if (shouldRunTypeScopes) {
        stepsForType.push(
          ...this.createStepsForType(typeConfig, {
            ...skipScopeOptions,
            // The interface's `grantScopes` still run: `skipInterfaceScopes` opts out of auth
            // checks, and dropping the grant would newly deny `$granted` interface fields.
            skipTypeScopes: skipScopeOptions.skipTypeScopes || skipDeclaringInterfaceScopes,
            // The interfaces the declaring interface extends are interface scopes too, so the
            // concrete type's `skipInterfaceScopes` must reach them as well as the field option.
            skipInterfaceScopes:
              skipScopeOptions.skipInterfaceScopes || skipDeclaringInterfaceScopes,
          }),
        );
      }

      // For a field inherited from an interface, also enforce the policy of the concrete type the
      // field is being resolved on. Steps the declaring interface already contributed are not
      // repeated, and `runScopesOnType` is read from the concrete type so that a type running its
      // scopes in `isTypeOf` does not also run them here.
      if (inherited && this.runTypeScopesOnField(ownerTypeConfig)) {
        const seen = new Set<string | undefined>();

        // When the pass above ran, the declaring interface's own auth check is its decision to
        // make, including the decision to omit it for `skipTypeScopes` or `skipInterfaceScopes`.
        // The concrete type implements that interface, so its interface walk below would otherwise
        // add the check back through a gate the pass above does not share, undoing an explicit opt
        // out. Seeding the key covers the omitted case; emitted steps are added below.
        //
        // `runScopesOnType` on the declaring interface is not such an opt out: it skips the pass
        // above entirely, moving the interface's scopes off its own fields. An interface has no
        // `isTypeOf` to move them to, so the concrete type's interface list is the only place left
        // to enforce them, and the key is deliberately not seeded.
        if (shouldRunTypeScopes) {
          seen.add(typeAuthScopesStepKey(typeConfig.name));
        }

        for (const step of stepsForType) {
          seen.add(step.key);
        }

        for (const step of this.createStepsForType(ownerTypeConfig, skipScopeOptions)) {
          if (!step.key || !seen.has(step.key)) {
            stepsForType.push(step);
          }
        }
      }
    }

    const fieldAuthScopes = fieldConfig.pothosOptions.authScopes;
    const fieldGrantScopes = fieldConfig.pothosOptions.grantScopes;

    const steps: ResolveStep<Types>[] = [...stepsForType];

    if (fieldAuthScopes && !authorizedOnSubscribe) {
      steps.push(createFieldAuthScopesStep(fieldAuthScopes));
    }

    steps.push(createResolveStep(resolver));

    if (fieldGrantScopes) {
      steps.push(createFieldGrantScopesStep(fieldGrantScopes));
    }

    return steps;
  }

  createSubscribeSteps(
    fieldConfig: PothosOutputFieldConfig<Types>,
    typeConfig:
      | PothosInterfaceTypeConfig
      | PothosMutationTypeConfig
      | PothosObjectTypeConfig
      | PothosQueryTypeConfig
      | PothosSubscriptionTypeConfig,
    subscriber: GraphQLFieldResolver<unknown, Types['Context'], object>,
  ): ResolveStep<Types>[] {
    const stepsForType = this.createStepsForType(typeConfig, {
      skipTypeScopes:
        ((fieldConfig.graphqlKind === 'Interface' || fieldConfig.graphqlKind === 'Object') &&
          fieldConfig.pothosOptions.skipTypeScopes) ??
        false,
      skipInterfaceScopes:
        ((fieldConfig.graphqlKind === 'Interface' || fieldConfig.kind === 'Object') &&
          fieldConfig.pothosOptions.skipInterfaceScopes) ??
        false,
      forField: true,
    });

    const fieldAuthScopes = fieldConfig.pothosOptions.authScopes;

    const steps: ResolveStep<Types>[] = [...stepsForType];

    if (fieldAuthScopes) {
      steps.push(createFieldAuthScopesStep(fieldAuthScopes));
    }

    steps.push(createResolveStep(subscriber));

    return steps;
  }
}

const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<
  SchemaTypes,
  unknown,
  FieldKind
>;

fieldBuilderProto.authField = function authField(options) {
  return this.field(options as never);
};

SchemaBuilder.registerPlugin(pluginName, PothosScopeAuthPlugin, {
  v3: (options) => ({
    scopeAuthOptions: undefined,
    authScopes: undefined,
    scopeAuth: {
      ...options.scopeAuthOptions,
      authScopes: options.authScopes,
    },
  }),
});
