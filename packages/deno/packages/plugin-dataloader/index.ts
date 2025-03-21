// @ts-nocheck
import './global-types.ts';
import './field-builder.ts';
import './schema-builder.ts';
import SchemaBuilder, { BasePlugin, isThenable, type MaybePromise, type PothosOutputFieldConfig, type SchemaTypes, unwrapOutputFieldType, } from '../core/index.ts';
import type DataLoader from 'https://cdn.skypack.dev/dataloader?dts';
import type { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
export * from './refs/index.ts';
export * from './types.ts';
export * from './util.ts';
const pluginName = "dataloader";
export class PothosDataloaderPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        const isList = fieldConfig.type.kind === "List";
        const config = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));
        const getDataloader = config.extensions?.getDataloader as (context: object) => DataLoader<unknown, unknown>;
        if (!getDataloader) {
            return resolver;
        }
        const cacheResolved = config.extensions?.cacheResolved as ((val: unknown) => string) | undefined;
        function loadIfID(idOrResult: unknown, loader: DataLoader<unknown, unknown>): unknown {
            if (idOrResult == null) {
                return idOrResult;
            }
            if (isThenable(idOrResult)) {
                return idOrResult.then((result) => loadIfID(result, loader));
            }
            switch (typeof idOrResult) {
                case "number":
                case "bigint":
                case "string":
                    return loader.load(idOrResult);
                default:
                    if (cacheResolved) {
                        const key = cacheResolved(idOrResult);
                        loader.prime(key, idOrResult);
                    }
                    return idOrResult;
            }
        }
        if (isList) {
            return (parent, args, context, info) => {
                const loader = getDataloader(context);
                const promiseOrResults = resolver(parent, args, context, info) as MaybePromise<unknown[] | null | undefined>;
                if (isThenable(promiseOrResults)) {
                    return promiseOrResults.then((results) => results?.map((item) => loadIfID(item, loader)));
                }
                return promiseOrResults?.map((item) => loadIfID(item, loader));
            };
        }
        return (parent, args, context, info) => loadIfID(resolver(parent, args, context, info), getDataloader(context));
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosDataloaderPlugin);
export default pluginName;
