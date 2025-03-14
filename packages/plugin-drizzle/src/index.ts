import './global-types';
import './field-builder';
import './schema-builder';
import SchemaBuilder, {
  BasePlugin,
  createInputValueMapper,
  type InputTypeFieldsMapping,
  mapInputFields,
  type PothosOutputFieldConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver } from 'graphql';
import type { ModelLoader } from './model-loader';
import type { DrizzleGraphQLInputExtensions } from './types';
// import {
//   extractFilters,
//   extractOrderBy,
//   remapFromGraphQLSingleInput,
// } from './utils/drizzle-graphql';
import { getLoaderMapping, setLoaderMappings } from './utils/loader-map';
export { drizzleClientCache } from './utils/config';

export * from './types';

export { drizzleTableName } from './types';

const pluginName = 'drizzle';

export default pluginName;

export class PothosDrizzlePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  // private mappingCache = new Map<
  //   string,
  //   InputTypeFieldsMapping<Types, DrizzleGraphQLInputExtensions>
  // >();
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    // const argMappings = mapInputFields<Types, DrizzleGraphQLInputExtensions>(
    //   fieldConfig.args,
    //   this.buildCache,
    //   (inputField) => {
    //     if (inputField.type.kind === 'InputObject') {
    //       const config = this.buildCache.getTypeConfig(inputField.type.ref);

    //       return (config.extensions?.drizzleGraphQL as DrizzleGraphQLInputExtensions) ?? null;
    //     }

    //     return null;
    //   },
    //   this.mappingCache,
    // );

    // const argMapper = argMappings
    //   ? createInputValueMapper(argMappings, (input, mappings) => {
    //       if (!mappings.value) {
    //         return input;
    //       }

    //       const { table, tableConfig, inputType } = mappings.value;

    //       switch (inputType) {
    //         case 'orderBy':
    //           return extractOrderBy(tableConfig, input as never);
    //         case 'filters':
    //           return extractFilters(tableConfig, table, input as never);
    //         case 'insert':
    //           return remapFromGraphQLSingleInput(input as never, tableConfig);
    //         case 'update':
    //           return remapFromGraphQLSingleInput(input as never, tableConfig);

    //         default:
    //           throw new Error(`Unknown drizzle input type: ${inputType}`);
    //       }
    //     })
    //   : null;

    // const argMappers: typeof fieldConfig.argMappers = argMapper
    //   ? [...(fieldConfig.argMappers ?? []), (args) => argMapper(args, undefined)]
    //   : fieldConfig.argMappers;

    if (fieldConfig.kind === 'DrizzleObject' && fieldConfig.pothosOptions.select) {
      const { select } = fieldConfig.pothosOptions;
      return {
        ...fieldConfig,
        // argMappers,
        extensions: {
          ...fieldConfig.extensions,
          pothosDrizzleSelect:
            typeof select === 'function'
              ? (
                  args: {},
                  ctx: Types['Context'],
                  nestedQuery: (query: unknown, path?: string[]) => never,
                ) => ({
                  select: (select as (args: unknown, ctx: unknown, nestedQuery: unknown) => {})(
                    args,
                    ctx,
                    nestedQuery,
                  ),
                })
              : select,
        },
      };
    }

    return {
      ...fieldConfig,
      // argMappers,
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (fieldConfig.kind !== 'DrizzleObject' || !fieldConfig.extensions?.pothosDrizzleSelect) {
      return resolver;
    }

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);

    const parentTypes = new Set([fieldConfig.parentType]);

    if (parentConfig.kind === 'Interface' || parentConfig.kind === 'Object') {
      for (const iface of parentConfig.interfaces) {
        const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
        if (interfaceConfig.extensions?.pothosDrizzleModel) {
          parentTypes.add(interfaceConfig.name);
        }
      }
    }

    const modelLoader = parentConfig.extensions?.pothosDrizzleLoader as ReturnType<
      typeof ModelLoader.forModel
    >;

    if (!modelLoader) {
      throw new Error(`ModelLoader not found for type ${parentConfig.name}`);
    }

    return (parent, args, context, info) => {
      let mapping = getLoaderMapping(context, info.path, info.parentType.name);

      if (!mapping) {
        for (const parentType of parentTypes) {
          mapping = getLoaderMapping(context, info.path, parentType);
          if (mapping) {
            break;
          }
        }
      }

      if (mapping) {
        setLoaderMappings(context, info, mapping);

        return resolver(parent, args, context, info);
      }

      const primaryKeys = (
        parentConfig.extensions!.pothosDrizzleTable as { primaryKey?: { name: string }[] }
      ).primaryKey;

      if (!primaryKeys || primaryKeys.length === 0) {
        throw new Error(
          `Field ${fieldConfig.name} not resolved in initial query and no primary key found for type ${parentConfig.name}`,
        );
      }

      return modelLoader(context)
        .loadSelection(info, parent as object)
        .then((result) => resolver(result, args, context, info));
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosDrizzlePlugin, {});
