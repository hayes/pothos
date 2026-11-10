import './global-types.js';
import './schema-builder.js';
import './field-builder.js';
import { BasePlugin, type BuildCache, type PothosOutputFieldConfig, type PothosTypeConfig, type SchemaTypes } from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';
import type { PrismaModelTypes } from './types.js';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors.js';
import { getModel, getRefFromModel } from './util/datamodel.js';
import { queryFromInfo } from './util/map-query.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaInterfaceRef, type PrismaRef } from './interface-ref.js';
export { PrismaNodeRef } from './node-ref.js';
export { PrismaObjectRef, prismaModelKey } from './object-ref.js';
export * from './types.js';
export { type DMMFField, prismaClientCache } from './util/get-client.js';
declare const pluginName = "prisma";
export default pluginName;
export { formatPrismaCursor, getModel, getRefFromModel, parsePrismaCursor, queryFromInfo };
/**
 * @deprecated This is core's `ObjectFieldBuilder`, not the `t` prisma types' `fields` receive. Use
 * `PothosSchemaTypes.PrismaObjectFieldBuilder` for that, and to add methods to it.
 */
export type PrismaObjectFieldBuilder<Types extends SchemaTypes, ParentShape> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
export declare const ObjectFieldBuilder: new <Types extends SchemaTypes, Model extends PrismaModelTypes, Shape extends object = Model['Shape']>(typename: string, builder: PothosSchemaTypes.SchemaBuilder<Types>) => PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, Shape>;
export declare class PothosPrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    constructor(cache: BuildCache<Types>);
    onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig;
    onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>): PothosOutputFieldConfig<Types> | null;
    wrapResolve(resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>, fieldConfig: PothosOutputFieldConfig<Types>): GraphQLFieldResolver<unknown, Types['Context'], object>;
}
