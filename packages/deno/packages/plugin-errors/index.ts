// @ts-nocheck
import './global-types.ts';
import { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import SchemaBuilder, { BasePlugin, GiraphQLOutputFieldConfig, SchemaTypes, sortClasses, } from '../core/index.ts';
export * from './types.ts';
const pluginName = "errors";
export default pluginName;
export function capitalize(s: string) {
    return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
function createErrorProxy(target: {}): {} {
    return new Proxy(target, {
        getPrototypeOf(err) {
            const proto = Object.getPrototypeOf(err) as {};
            if (!proto) {
                return proto;
            }
            return createErrorProxy(proto);
        },
    });
}
const errorTypeMap = new WeakMap<{}, new (...args: any[]) => Error>();
export class GiraphQLErrorsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>): GiraphQLOutputFieldConfig<Types> | null {
        if (!fieldConfig.giraphqlOptions.errors) {
            return fieldConfig;
        }
        const parentTypeName = this.buildCache.getTypeConfig(fieldConfig.parentType).name;
        const { types = [], result: { name: resultName = `${parentTypeName}${capitalize(fieldConfig.name)}Success`, fields: resultFieldOptions, ...resultObjectOptions } = {} as never, union: { name: unionName = `${parentTypeName}${capitalize(fieldConfig.name)}Result`, ...unionOptions } = {} as never, dataField: { name: dataFieldName = "data", ...dataField } = {} as never, } = fieldConfig.giraphqlOptions.errors;
        const resultObjectRef = this.builder.objectRef<unknown>(resultName);
        resultObjectRef.implement({
            ...resultObjectOptions,
            fields: (t) => ({
                ...resultFieldOptions?.(t),
                [dataFieldName]: t.field({
                    ...dataField,
                    type: fieldConfig.giraphqlOptions.type,
                    nullable: fieldConfig.type.kind === "List"
                        ? { items: fieldConfig.type.type.nullable, list: false }
                        : false,
                    resolve: (data) => data as never,
                }),
            }),
        });
        const errorTypes = sortClasses([
            ...new Set([...types, ...(this.builder.options.errorOptions?.defaultTypes ?? [])]),
        ]);
        const unionType = this.builder.unionType(unionName, {
            types: [...errorTypes, resultObjectRef],
            resolveType: (obj) => errorTypeMap.get(obj as {}) ?? resultObjectRef,
            ...unionOptions,
        });
        return {
            ...fieldConfig,
            extensions: {
                ...fieldConfig.extensions,
                giraphqlErrors: errorTypes,
            },
            type: {
                kind: "Union",
                ref: unionType,
                nullable: fieldConfig.type.nullable,
            },
        };
    }
    wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: GiraphQLOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        const giraphqlErrors = fieldConfig.extensions?.giraphqlErrors as typeof Error[] | undefined;
        if (!giraphqlErrors) {
            return resolver;
        }
        return async (...args) => {
            try {
                return (await resolver(...args)) as never;
            }
            catch (error: unknown) {
                for (const errorType of giraphqlErrors) {
                    if (error instanceof errorType) {
                        const result = createErrorProxy(error);
                        errorTypeMap.set(result, errorType);
                        return result;
                    }
                }
                throw error;
            }
        };
    }
}
SchemaBuilder.registerPlugin(pluginName, GiraphQLErrorsPlugin);
