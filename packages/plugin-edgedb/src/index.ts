/* eslint-disable no-console */
import './global-types';
import './schema-builder';
import { GraphQLFieldResolver, GraphQLTypeResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  BuildCache,
  PothosInterfaceTypeConfig,
  PothosOutputFieldConfig,
  PothosUnionTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import { EdgeDBObjectFieldBuilder as InternalEdgeDBObjectFieldBuilder } from './field-builder';

export * from './types';

const pluginName = 'edgedb' as const;

export default pluginName;

export type EdgeDBObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export const ObjectFieldBuilder = InternalEdgeDBObjectFieldBuilder as new <
  Types extends SchemaTypes,
  Model extends
    | ({ [ModelKey in keyof Model]: Model[ModelKey] extends infer U ? U : never } & {
        Fields: string | never;
        Links: {
          [Key in Model['Fields']]: {
            Shape: Model['Links'][Key];
          };
        };
      })
    | never,
  Shape extends object = Model,
>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.EdgeDBObjectFieldBuilder<Types, Model, Shape>;

export class EdgeDBPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (fieldConfig.kind === 'EdgeDBObject') {
      console.log('[plugin-edgedb] Received object of type `EdgeDBObject` ');
    }

    return fieldConfig;
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (fieldConfig.kind !== 'EdgeDBObject') {
      return resolver;
    }

    return (parent, args, context, info) => {
      console.log(`Resolving ${info.parentType}.${info.fieldName}`);

      return resolver(parent, args, context, info);
    };
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ) {
    return resolveType;
  }
}

SchemaBuilder.registerPlugin(pluginName, EdgeDBPlugin);
