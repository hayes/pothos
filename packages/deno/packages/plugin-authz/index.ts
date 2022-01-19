// @ts-nocheck
import './global-types.ts';
import SchemaBuilder, { BasePlugin, PothosOutputFieldConfig, PothosTypeConfig, SchemaTypes, } from '../core/index.ts';
export * from './types.ts';
const pluginName = "authz" as const;
export class PothosAuthZPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>): PothosOutputFieldConfig<Types> | null {
        const { authz } = fieldConfig.pothosOptions;
        if (!authz) {
            return fieldConfig;
        }
        return {
            ...fieldConfig,
            extensions: {
                ...fieldConfig,
                authz: {
                    directives: [
                        {
                            name: "authz",
                            arguments: authz,
                        },
                    ],
                },
            },
        };
    }
    override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
        if ((typeConfig.graphqlKind !== "Object" && typeConfig.graphqlKind !== "Interface") ||
            typeConfig.kind === "Query" ||
            typeConfig.kind === "Mutation" ||
            typeConfig.kind === "Subscription") {
            return typeConfig;
        }
        const { authz } = typeConfig.pothosOptions;
        if (!authz) {
            return typeConfig;
        }
        return {
            ...typeConfig,
            extensions: {
                ...typeConfig,
                authz: {
                    directives: [
                        {
                            name: "authz",
                            arguments: authz,
                        },
                    ],
                },
            },
        };
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosAuthZPlugin);
export default pluginName;
