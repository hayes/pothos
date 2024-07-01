// @ts-nocheck
import './global-types.ts';
import './schema-builder.ts';
import './field-builders.ts';
import { GraphQLFieldResolver, GraphQLIsTypeOfFn, GraphQLTypeResolver } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, FieldKind, PothosInterfaceTypeConfig, PothosMutationTypeConfig, PothosObjectTypeConfig, PothosOutputFieldConfig, PothosQueryTypeConfig, PothosSchemaError, PothosSubscriptionTypeConfig, PothosUnionTypeConfig, RootFieldBuilder, SchemaTypes, } from '../core/index.ts';
import { isTypeOfHelper } from './is-type-of-helper.ts';
import RequestCache from './request-cache.ts';
import { resolveHelper } from './resolve-helper.ts';
import { createFieldAuthScopesStep, createFieldGrantScopesStep, createResolveStep, createTypeAuthScopesStep, createTypeGrantScopesStep, } from './steps.ts';
import { ResolveStep, TypeAuthScopes, TypeGrantScopes } from './types.ts';
export { RequestCache };
export * from './errors.ts';
export * from './types.ts';
const pluginName = "scopeAuth";
export default pluginName;
let inResolveType = false;
export class PothosScopeAuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        if (this.options.disableScopeAuth) {
            return resolver;
        }
        const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
        if (typeConfig.graphqlKind !== "Object" && typeConfig.graphqlKind !== "Interface") {
            throw new PothosSchemaError(`Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`);
        }
        const authorizedOnSubscribe = !!this.builder.options.scopeAuth?.authorizeOnSubscribe && typeConfig.kind === "Subscription";
        const nonRoot = (typeConfig.graphqlKind === "Interface" || typeConfig.graphqlKind === "Object") &&
            typeConfig.kind !== "Query" &&
            typeConfig.kind !== "Mutation" &&
            typeConfig.kind !== "Subscription";
        const runTypeScopesOnField = !nonRoot ||
            !(typeConfig.pothosOptions.runScopesOnType ??
                this.builder.options.scopeAuth?.runScopesOnType ??
                false);
        const steps = this.createResolveSteps(fieldConfig, typeConfig, resolver, runTypeScopesOnField, authorizedOnSubscribe);
        if (steps.length > 1) {
            return resolveHelper(steps, this, fieldConfig);
        }
        return resolver;
    }
    override wrapSubscribe(subscriber: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        if (this.options.disableScopeAuth) {
            return subscriber;
        }
        const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
        if (typeConfig.graphqlKind !== "Object" && typeConfig.graphqlKind !== "Interface") {
            throw new PothosSchemaError(`Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`);
        }
        if (!this.builder.options.scopeAuth?.authorizeOnSubscribe ||
            typeConfig.kind !== "Subscription") {
            return subscriber;
        }
        const steps = this.createSubscribeSteps(fieldConfig, typeConfig, subscriber);
        if (steps.length > 1) {
            return resolveHelper(steps, this, fieldConfig);
        }
        return subscriber;
    }
    override wrapResolveType(resolveType: GraphQLTypeResolver<unknown, Types["Context"]>, typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig): GraphQLTypeResolver<unknown, Types["Context"]> {
        return (...args) => {
            inResolveType = true;
            try {
                return resolveType(...args);
            }
            finally {
                inResolveType = false;
            }
        };
    }
    override wrapIsTypeOf(isTypeOf: GraphQLIsTypeOfFn<unknown, Types["Context"]> | undefined, typeConfig: PothosObjectTypeConfig): GraphQLIsTypeOfFn<unknown, Types["Context"]> | undefined {
        if (this.options.disableScopeAuth) {
            return isTypeOf;
        }
        const shouldRunTypeScopes = typeConfig.pothosOptions.runScopesOnType ??
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
    createStepsForType(typeConfig: PothosInterfaceTypeConfig | PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig, { skipTypeScopes, skipInterfaceScopes, forField, }: {
        skipTypeScopes?: boolean;
        skipInterfaceScopes?: boolean;
        forField: boolean;
    }) {
        const parentAuthScope = typeConfig.pothosOptions.authScopes;
        const parentGrantScopes = typeConfig.pothosOptions.grantScopes;
        const interfaceConfigs = typeConfig.kind === "Object" || typeConfig.kind === "Interface"
            ? typeConfig.interfaces.map((iface) => this.buildCache.getTypeConfig(iface, "Interface"))
            : [];
        const steps: ResolveStep<Types>[] = [];
        if (parentAuthScope && !skipTypeScopes) {
            steps.push(createTypeAuthScopesStep(parentAuthScope as TypeAuthScopes<Types, unknown>, typeConfig.name));
        }
        if (!skipInterfaceScopes &&
            !(typeConfig.kind === "Object" && typeConfig.pothosOptions.skipInterfaceScopes)) {
            interfaceConfigs.forEach((interfaceConfig) => {
                if (interfaceConfig.pothosOptions.authScopes) {
                    steps.push(createTypeAuthScopesStep(interfaceConfig.pothosOptions.authScopes as TypeAuthScopes<Types, unknown>, interfaceConfig.name));
                }
            });
        }
        if (parentGrantScopes) {
            steps.push(createTypeGrantScopesStep(parentGrantScopes as TypeGrantScopes<Types, unknown>, typeConfig.name, forField));
        }
        return steps;
    }
    createResolveSteps(fieldConfig: PothosOutputFieldConfig<Types>, typeConfig: PothosInterfaceTypeConfig | PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig, resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, shouldRunTypeScopes: boolean, authorizedOnSubscribe: boolean): ResolveStep<Types>[] {
        const stepsForType = shouldRunTypeScopes && !authorizedOnSubscribe
            ? this.createStepsForType(typeConfig, {
                skipTypeScopes: ((fieldConfig.graphqlKind === "Interface" || fieldConfig.graphqlKind === "Object") &&
                    fieldConfig.pothosOptions.skipTypeScopes) ??
                    false,
                skipInterfaceScopes: ((fieldConfig.graphqlKind === "Interface" || fieldConfig.kind === "Object") &&
                    fieldConfig.pothosOptions.skipInterfaceScopes) ??
                    false,
                forField: true,
            })
            : [];
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
    createSubscribeSteps(fieldConfig: PothosOutputFieldConfig<Types>, typeConfig: PothosInterfaceTypeConfig | PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig, subscriber: GraphQLFieldResolver<unknown, Types["Context"], object>): ResolveStep<Types>[] {
        const stepsForType = this.createStepsForType(typeConfig, {
            skipTypeScopes: ((fieldConfig.graphqlKind === "Interface" || fieldConfig.graphqlKind === "Object") &&
                fieldConfig.pothosOptions.skipTypeScopes) ??
                false,
            skipInterfaceScopes: ((fieldConfig.graphqlKind === "Interface" || fieldConfig.kind === "Object") &&
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
const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
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
