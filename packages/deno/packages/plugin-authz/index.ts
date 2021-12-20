// @ts-nocheck
import './global-types.ts';
import SchemaBuilder, { BasePlugin, GiraphQLOutputFieldConfig, GiraphQLTypeConfig, SchemaTypes, } from '../core/index.ts';
export * from './types.ts';
const pluginName = "authz" as const;
export class GiraphQLAuthZPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>): GiraphQLOutputFieldConfig<Types> | null {
        const { authz } = fieldConfig.giraphqlOptions;
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
    override onTypeConfig(typeConfig: GiraphQLTypeConfig): GiraphQLTypeConfig {
        if ((typeConfig.graphqlKind !== "Object" && typeConfig.graphqlKind !== "Interface") ||
            typeConfig.kind === "Query" ||
            typeConfig.kind === "Mutation" ||
            typeConfig.kind === "Subscription") {
            return typeConfig;
        }
        const { authz } = typeConfig.giraphqlOptions;
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
SchemaBuilder.registerPlugin(pluginName, GiraphQLAuthZPlugin);
export default pluginName;
