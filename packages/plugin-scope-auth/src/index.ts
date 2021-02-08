import SchemaBuilder, {
  BasePlugin,
  GiraphQLInterfaceTypeConfig,
  GiraphQLObjectTypeConfig,
  GiraphQLOutputFieldConfig,
  SchemaTypes,
} from '@giraphql/core';
import { GraphQLFieldResolver } from 'graphql';
import './global-types';
import { resolveHelper } from './resolve-helper';
import {
  createFieldAuthScopesStep,
  createFieldGrantScopesStep,
  createResolveStep,
  createTypeAuthScopesStep,
  createTypeGrantScopesStep,
} from './steps';
import { ResolveStep } from './types';

export * from './types';

export default class ScopeAuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  name: 'GiraphQLScopeAuth' = 'GiraphQLScopeAuth';

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    // TODO add build option for disabling auth

    const typeConfig = this.configStore.getTypeConfig(fieldConfig.parentType);

    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      throw new Error(
        `Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`,
      );
    }

    const steps = this.createResolveSteps(fieldConfig, typeConfig, resolver);

    if (steps.length > 1) {
      return resolveHelper(steps, this);
    }

    return resolver;
  }

  createResolveSteps(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    typeConfig: GiraphQLObjectTypeConfig | GiraphQLInterfaceTypeConfig,
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
  ): ResolveStep<Types>[] {
    const parentAuthScope = typeConfig.giraphqlOptions.authScopes;
    const parentGrantScopes = typeConfig.giraphqlOptions.grantScopes;
    const fieldAuthScopes = fieldConfig.giraphqlOptions.authScopes;
    const fieldGrantScopes = fieldConfig.giraphqlOptions.grantScopes;

    const steps: ResolveStep<Types>[] = [];

    // TODO add steps for interfaces
    // TODO add validation for required checks based on options

    if (parentAuthScope) {
      steps.push(createTypeAuthScopesStep<Types>(parentAuthScope, typeConfig.name));
    }

    if (parentGrantScopes) {
      steps.push(createTypeGrantScopesStep<Types>(parentGrantScopes, typeConfig.name));
    }

    if (fieldAuthScopes) {
      steps.push(createFieldAuthScopesStep(fieldAuthScopes));
    }

    steps.push(createResolveStep(resolver));

    if (fieldGrantScopes) {
      steps.push(createFieldGrantScopesStep(fieldGrantScopes));
    }

    return steps;
  }
}

SchemaBuilder.registerPlugin('GiraphQLScopeAuth', ScopeAuthPlugin);
