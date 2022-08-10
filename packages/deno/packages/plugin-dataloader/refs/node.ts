// @ts-nocheck
import { GraphQLResolveInfo } from 'https://cdn.skypack.dev/graphql?dts';
import { FieldRef, InterfaceRef, PothosObjectTypeConfig, SchemaTypes } from '../../core/index.ts';
import { DataLoaderOptions, LoadableNodeId } from '../types.ts';
import { ImplementableLoadableObjectRef } from './object.ts';
export class ImplementableLoadableNodeRef<Types extends SchemaTypes, RefShape, Shape extends object, Key extends bigint | number | string, CacheKey> extends ImplementableLoadableObjectRef<Types, RefShape, Shape, Key, CacheKey> {
    private idOptions;
    constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string, { id, ...options }: DataLoaderOptions<Types, Shape, Key, CacheKey> & LoadableNodeId<Types, Shape>) {
        super(builder, name, options);
        this.idOptions = id;
        this.builder.configStore.onTypeConfig(this, (config) => {
            const nodeInterface = (this.builder as PothosSchemaTypes.SchemaBuilder<Types> & {
                nodeInterfaceRef: () => InterfaceRef<unknown>;
            }).nodeInterfaceRef();
            // eslint-disable-next-line no-param-reassign
            (config.pothosOptions as {
                loadManyWithoutCache: unknown;
            }).loadManyWithoutCache = (ids: Key[], context: SchemaTypes["Context"]) => this.getDataloader(context).loadMany(ids);
            const { interfaces } = config as PothosObjectTypeConfig;
            if (!interfaces.includes(nodeInterface)) {
                interfaces.push(nodeInterface);
            }
            this.builder.objectField(this, (this.builder.options as {
                relayOptions?: {
                    idFieldName?: string;
                };
            }).relayOptions
                ?.idFieldName ?? "id", (t) => (t as unknown as {
                globalID: (options: Record<string, unknown>) => FieldRef<unknown>;
            }).globalID({
                ...this.idOptions,
                nullable: false,
                args: {},
                resolve: async (parent: Shape, args: object, context: object, info: GraphQLResolveInfo) => ({
                    type: config.name,
                    id: await this.idOptions.resolve(parent, args, context, info),
                }),
            }));
        });
    }
}
