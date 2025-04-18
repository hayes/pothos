// @ts-nocheck
import './global-types.ts';
import SchemaBuilder, { BasePlugin, type PothosOutputFieldConfig, type SchemaTypes, } from '../core/index.ts';
import type { GraphQLFieldResolver } from 'https://cdn.skypack.dev/graphql?dts';
import type { ResolverMap } from './types.ts';
const pluginName = "mocks";
export default pluginName;
export class PothosMocksPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override wrapResolve(resolver: GraphQLFieldResolver<unknown, Types["Context"], object>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> {
        const { mocks } = this.options;
        if (!mocks) {
            return resolver;
        }
        const resolveMock = this.resolveMock(fieldConfig.parentType, fieldConfig.name, mocks);
        return resolveMock ?? resolver;
    }
    override wrapSubscribe(subscribe: GraphQLFieldResolver<unknown, Types["Context"], object> | undefined, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types["Context"], object> | undefined {
        const { mocks } = this.options;
        if (!mocks) {
            return subscribe;
        }
        const subscribeMock = this.subscribeMock(fieldConfig.parentType, fieldConfig.name, mocks);
        return subscribeMock ?? subscribe;
    }
    resolveMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
        const fieldMock = mocks[typename]?.[fieldName] || null;
        if (!fieldMock) {
            return null;
        }
        if (typeof fieldMock === "function") {
            return fieldMock;
        }
        return fieldMock.resolve || null;
    }
    subscribeMock(typename: string, fieldName: string, mocks: ResolverMap<Types>) {
        const fieldMock = mocks[typename]?.[fieldName] || null;
        if (!fieldMock) {
            return null;
        }
        if (typeof fieldMock === "function") {
            return null;
        }
        return fieldMock.subscribe || null;
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosMocksPlugin);
