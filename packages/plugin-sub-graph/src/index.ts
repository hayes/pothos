/* eslint-disable no-param-reassign */
import SchemaBuilder, {
  SchemaTypes,
  BasePlugin,
  GiraphQLTypeConfig,
  GiraphQLOutputFieldConfig,
} from '@giraphql/core';
import {
  GraphQLEnumType,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLUnionType,
} from 'graphql';

import './global-types';
import { replaceType } from './util';

const schemaBuilderProto = SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<
  SchemaTypes
>;

schemaBuilderProto.toSubGraphSchema = function toSubGraphSchema(options, subGraph) {
  return (this.getPlugin('GiraphQLSubGraph') as SubGraphPlugin<SchemaTypes>).createSubGraph(
    this.toSchema(options),
    subGraph,
  );
};

export default class SubGraphPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    typeConfig.extensions = {
      ...typeConfig.extensions,
      subGraphs:
        typeConfig.giraphqlOptions.subGraphs ||
        this.builder.options.subGraphs?.defaultForTypes ||
        [],
    };
  }

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    const typeConfig = this.builder.configStore.getTypeConfig(fieldConfig.parentType);

    if (typeConfig.graphqlKind !== 'Interface' && typeConfig.graphqlKind !== 'Object') {
      return;
    }

    let subGraphs: Types['SubGraphs'][] = [];

    if (fieldConfig.giraphqlOptions.subGraphs) {
      subGraphs = fieldConfig.giraphqlOptions.subGraphs;
    } else if (typeConfig.giraphqlOptions.defaultSubGraphsForFields) {
      subGraphs = typeConfig.giraphqlOptions.defaultSubGraphsForFields;
    } else if (this.builder.options.subGraphs?.fieldsInheritFromTypes) {
      subGraphs = (typeConfig.extensions?.subGraphs as Types['SubGraphs'][]) || [];
    }

    fieldConfig.extensions = {
      ...fieldConfig.extensions,
      subGraphs,
    };
  }

  createSubGraph(schema: GraphQLSchema, subGraph: string) {
    const config = schema.toConfig();
    const newTypes = this.filterTypes(config.types, subGraph);

    return new GraphQLSchema({
      types: [...newTypes.values()],
      directives: config.directives,
      extensions: config.extensions,
      extensionASTNodes: config.extensionASTNodes,
      assumeValid: false,
      query: newTypes.get('Query') as GraphQLObjectType,
      mutation: newTypes.get('Mutation') as GraphQLObjectType,
      subscription: newTypes.get('Subscription') as GraphQLObjectType,
    });
  }

  filterTypes(types: GraphQLNamedType[], subGraph: string) {
    const newTypes = new Map<string, GraphQLNamedType>();

    types.forEach((type) => {
      if (type.name.startsWith('__')) {
        return;
      }

      const config = this.builder.configStore.getTypeConfig(type.name);

      if (
        type.name === 'String' ||
        type.name === 'Int' ||
        type.name === 'Float' ||
        type.name === 'Boolean' ||
        type.name === 'ID'
      ) {
        newTypes.set(type.name, type);
      }

      if (!(config.extensions?.subGraphs as string[])?.includes(subGraph)) {
        return;
      }

      if (type instanceof GraphQLScalarType || type instanceof GraphQLEnumType) {
        newTypes.set(type.name, type);
      } else if (type instanceof GraphQLObjectType) {
        const typeConfig = type.toConfig();
        newTypes.set(
          type.name,
          new GraphQLObjectType({
            ...typeConfig,
            interfaces: () =>
              typeConfig.interfaces.map((iface) =>
                replaceType(iface, newTypes, typeConfig.name, subGraph),
              ),
            fields: this.filterFields(type, newTypes, subGraph),
          }),
        );
      } else if (type instanceof GraphQLInterfaceType) {
        const typeConfig = type.toConfig();
        newTypes.set(
          type.name,
          new GraphQLInterfaceType({
            ...typeConfig,
            interfaces: () =>
              typeConfig.interfaces.map((iface) =>
                replaceType(iface, newTypes, typeConfig.name, subGraph),
              ),
            fields: this.filterFields(type, newTypes, subGraph),
          }),
        );
      } else if (type instanceof GraphQLUnionType) {
        const typeConfig = type.toConfig();
        newTypes.set(
          type.name,
          new GraphQLUnionType({
            ...typeConfig,
            types: () =>
              typeConfig.types.map((member) =>
                replaceType(member, newTypes, typeConfig.name, subGraph),
              ),
          }),
        );
      } else if (type instanceof GraphQLInputObjectType) {
        const typeConfig = type.toConfig();
        newTypes.set(
          type.name,
          new GraphQLInputObjectType({
            ...typeConfig,
            fields: this.mapInputFields(type, newTypes, subGraph),
          }),
        );
      }
    });

    return newTypes;
  }

  filterFields(
    type: GraphQLObjectType | GraphQLInterfaceType,
    newTypes: Map<string, GraphQLNamedType>,
    subGraph: string,
  ) {
    const oldFields = type.getFields();

    return () => {
      const newFields: GraphQLFieldConfigMap<unknown, unknown> = {};

      Object.keys(oldFields).forEach((fieldName) => {
        const fieldConfig = oldFields[fieldName];

        const newArguments: GraphQLFieldConfigArgumentMap = {};

        if (!fieldConfig.extensions?.subGraphs?.includes(subGraph)) {
          return;
        }

        fieldConfig.args.forEach((argConfig) => {
          newArguments[argConfig.name] = {
            description: argConfig.description,
            defaultValue: argConfig.defaultValue as unknown,
            extensions: argConfig.extensions,
            astNode: argConfig.astNode,
            type: replaceType(
              argConfig.type,
              newTypes,
              `${argConfig.name} argument of ${type.name}.${fieldConfig.name}`,
              subGraph,
            ),
          };
        });

        newFields[fieldName] = {
          description: fieldConfig.description,
          resolve: fieldConfig.resolve,
          subscribe: fieldConfig.subscribe,
          deprecationReason: fieldConfig.deprecationReason,
          extensions: fieldConfig.extensions,
          astNode: fieldConfig.astNode,
          type: replaceType(
            fieldConfig.type,
            newTypes,
            `${type.name}.${fieldConfig.name}`,
            subGraph,
          ),
          args: newArguments,
        };
      });

      return newFields;
    };
  }

  mapInputFields(
    type: GraphQLInputObjectType,
    newTypes: Map<string, GraphQLNamedType>,
    subGraph: string,
  ) {
    const oldFields = type.getFields();

    return () => {
      const newFields: GraphQLInputFieldConfigMap = {};

      Object.keys(oldFields).forEach((fieldName) => {
        const fieldConfig = oldFields[fieldName];

        newFields[fieldName] = {
          description: fieldConfig.description,
          extensions: fieldConfig.extensions,
          astNode: fieldConfig.astNode,
          defaultValue: fieldConfig.defaultValue as unknown,
          type: replaceType(
            fieldConfig.type,
            newTypes,
            `${type.name}.${fieldConfig.name}`,
            subGraph,
          ),
        };
      });

      return newFields;
    };
  }
}

SchemaBuilder.registerPlugin('GiraphQLSubGraph', SubGraphPlugin);
