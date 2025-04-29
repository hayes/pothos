// @ts-nocheck
import './global-types.ts';
import './schema-builder.ts';
import SchemaBuilder, { BasePlugin, type SchemaTypes } from '../core/index.ts';
import { GraphQLSchema } from 'https://cdn.skypack.dev/graphql?dts';
import { addTypeToSchema } from './utils.ts';
const pluginName = "addGraphQL";
export default pluginName;
const builtInTypes = Object.keys(new GraphQLSchema({}).getTypeMap());
export class PothosAddGraphQLPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
    override beforeBuild(): void {
        const { schema, types } = this.builder.options.add ?? {};
        const allTypes = [
            ...(Array.isArray(types) ? types : Object.values(types ?? {})),
            ...Object.values(schema?.getTypeMap() ?? {}).filter((type) => !builtInTypes.includes(type.name)),
        ];
        for (const type of allTypes) {
            addTypeToSchema(this.builder, type);
        }
    }
}
SchemaBuilder.registerPlugin(pluginName, PothosAddGraphQLPlugin);
