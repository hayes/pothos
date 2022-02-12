// @ts-nocheck
import './global-types.ts';
import { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, FieldKind, PothosInterfaceTypeConfig, PothosMutationTypeConfig, PothosObjectTypeConfig, PothosOutputFieldConfig, PothosQueryTypeConfig, PothosSubscriptionTypeConfig, RootFieldBuilder, SchemaTypes, } from '../core/index.ts';
import { resolveHelper } from './resolve-helper.ts';
import { createFieldAuthScopesStep, createFieldGrantScopesStep, createResolveStep, createTypeAuthScopesStep, createTypeGrantScopesStep, } from './steps.ts';
import { ResolveStep, TypeAuthScopes, TypeGrantScopes } from './types.ts';
export * from './errors.ts';
export * from './types.ts';
const pluginName = "scopeAuth" as const;
export default pluginName;
export class PothosScopeAuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        if (this.options.disableScopeAuth) {
            return resolver;
        }
        const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
        if (typeConfig.graphqlKind !== "Object" && typeConfig.graphqlKind !== "Interface") {
            throw new Error(`Got fields for ${fieldConfig.parentType} which is a ${typeConfig.graphqlKind} which cannot have fields`);
        }
        const steps = this.createResolveSteps(fieldConfig, typeConfig, resolver);
        if (steps.length > 1) {
            return resolveHelper(steps, this, fieldConfig);
        }
        return resolver;
    }
    createStepsForType(typeConfig: PothosInterfaceTypeConfig | PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig, { skipTypeScopes, skipInterfaceScopes, forField, }: {
        skipTypeScopes: boolean;
        skipInterfaceScopes: boolean;
        forField: boolean;
    }) {
        const parentAuthScope = typeConfig.pothosOptions.authScopes;
        const parentGrantScopes = typeConfig.pothosOptions.grantScopes;
        const interfaceConfigs = typeConfig.kind === "Object" || typeConfig.kind === "Interface"
            ? typeConfig.interfaces.map((iface) => this.buildCache.getTypeConfig(iface.name, "Interface"))
            : [];
        const steps: ResolveStep<Types>[] = [];
        if (parentAuthScope && !skipTypeScopes) {
            steps.push(createTypeAuthScopesStep(parentAuthScope as TypeAuthScopes<Types, unknown>, typeConfig.name));
        }
        if (!skipInterfaceScopes) {
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
    createResolveSteps(fieldConfig: PothosOutputFieldConfig<Types>, typeConfig: PothosInterfaceTypeConfig | PothosMutationTypeConfig | PothosObjectTypeConfig | PothosQueryTypeConfig | PothosSubscriptionTypeConfig, resolver: GraphQLFieldResolver<unknown, Types["Context"], object>): ResolveStep<Types>[] {
        const stepsForType = this.createStepsForType(typeConfig, {
            skipTypeScopes: ((fieldConfig.kind === "Interface" || fieldConfig.kind === "Object") &&
                fieldConfig.pothosOptions.skipTypeScopes) ??
                false,
            skipInterfaceScopes: ((fieldConfig.kind === "Interface" || fieldConfig.kind === "Object") &&
                fieldConfig.pothosOptions.skipInterfaceScopes) ??
                false,
            forField: true,
        });
        const fieldAuthScopes = fieldConfig.pothosOptions.authScopes;
        const fieldGrantScopes = fieldConfig.pothosOptions.grantScopes;
        const steps: ResolveStep<Types>[] = [...stepsForType];
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
const fieldBuilderProto = RootFieldBuilder.prototype as PothosSchemaTypes.RootFieldBuilder<SchemaTypes, unknown, FieldKind>;
fieldBuilderProto.authField = function authField(options) {
    return this.field(options as never);
};
SchemaBuilder.registerPlugin(pluginName, PothosScopeAuthPlugin);
