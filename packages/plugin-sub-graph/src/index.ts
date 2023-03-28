/* eslint-disable prefer-destructuring */
import './global-types';
import {
  getNamedType,
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
  isInterfaceType,
  isNonNullType,
  isObjectType,
} from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosInputFieldConfig,
  PothosOutputFieldConfig,
  PothosSchemaError,
  PothosTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import { replaceType } from './util';

const pluginName = 'subGraph' as const;

export default pluginName;

function intersect(left: string[], right: string[]) {
  for (const entry of left) {
    if (right.includes(entry)) {
      return true;
    }
  }

  return false;
}

export class PothosSubGraphPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  static createSubGraph(schema: GraphQLSchema, subGraph: string[] | string) {
    const subGraphs = Array.isArray(subGraph) ? subGraph : [subGraph];

    const config = schema.toConfig();
    const newTypes = this.filterTypes(config.types, subGraphs);
    const returnedInterfaces = new Set<string>();

    for (const type of newTypes.values()) {
      if (isObjectType(type) || isInterfaceType(type)) {
        const fields = type.getFields();

        for (const field of Object.values(fields)) {
          const namedType = getNamedType(field.type);

          if (isInterfaceType(namedType)) {
            returnedInterfaces.add(namedType.name);
          }
        }
      }
    }

    function hasReturnedInterface(type: GraphQLObjectType | GraphQLInterfaceType): boolean {
      for (const iface of type.getInterfaces()) {
        if (returnedInterfaces.has(iface.name)) {
          return true;
        }

        if (hasReturnedInterface(iface)) {
          return true;
        }
      }

      return false;
    }

    return new GraphQLSchema({
      directives: config.directives,
      extensions: config.extensions,
      extensionASTNodes: config.extensionASTNodes,
      assumeValid: false,
      query: newTypes.get('Query') as GraphQLObjectType,
      mutation: newTypes.get('Mutation') as GraphQLObjectType,
      subscription: newTypes.get('Subscription') as GraphQLObjectType,
      // Explicitly include types that implement an interface that can be resolved in the subGraph
      types: [...newTypes.values()].filter(
        (type) => (isObjectType(type) || isInterfaceType(type)) && hasReturnedInterface(type),
      ),
    });
  }

  static filterTypes(types: readonly GraphQLNamedType[], subGraphs: string[]) {
    const newTypes = new Map<string, GraphQLNamedType>();

    types.forEach((type) => {
      if (type.name.startsWith('__')) {
        return;
      }

      if (
        type.name === 'String' ||
        type.name === 'Int' ||
        type.name === 'Float' ||
        type.name === 'Boolean' ||
        type.name === 'ID'
      ) {
        newTypes.set(type.name, type);
      }

      if (!intersect((type.extensions?.subGraphs as string[]) || [], subGraphs)) {
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
              typeConfig.interfaces
                .filter((iface) => newTypes.has(iface.name))
                .map((iface) => replaceType(iface, newTypes, typeConfig.name, subGraphs)),
            fields: this.filterFields(type, newTypes, subGraphs),
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
                replaceType(iface, newTypes, typeConfig.name, subGraphs),
              ),
            fields: this.filterFields(type, newTypes, subGraphs),
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
                replaceType(member, newTypes, typeConfig.name, subGraphs),
              ),
          }),
        );
      } else if (type instanceof GraphQLInputObjectType) {
        const typeConfig = type.toConfig();
        newTypes.set(
          type.name,
          new GraphQLInputObjectType({
            ...typeConfig,
            fields: this.mapInputFields(type, newTypes, subGraphs),
          }),
        );
      }
    });

    return newTypes;
  }

  static filterFields(
    type: GraphQLInterfaceType | GraphQLObjectType,
    newTypes: Map<string, GraphQLNamedType>,
    subGraphs: string[],
  ) {
    const oldFields = type.getFields();

    return () => {
      const newFields: GraphQLFieldConfigMap<unknown, unknown> = {};

      Object.keys(oldFields).forEach((fieldName) => {
        const fieldConfig = oldFields[fieldName];

        const newArguments: GraphQLFieldConfigArgumentMap = {};

        if (
          !intersect(
            (fieldConfig.extensions?.subGraphs as string[] | undefined) || [],
            subGraphs,
          ) ||
          !newTypes.has(getNamedType(fieldConfig.type).name)
        ) {
          return;
        }

        fieldConfig.args.forEach((argConfig) => {
          const argSubGraphs = argConfig.extensions?.subGraphs as string[] | undefined;

          if (argSubGraphs && !intersect(argSubGraphs, subGraphs)) {
            if (isNonNullType(argConfig.type)) {
              throw new PothosSchemaError(
                `argument ${argConfig.name} of ${type.name}.${fieldName} is NonNull and must be in included in all sub-graphs that include ${type.name}.${fieldName}`,
              );
            }

            return;
          }

          newArguments[argConfig.name] = {
            description: argConfig.description,
            defaultValue: argConfig.defaultValue,
            extensions: argConfig.extensions,
            astNode: argConfig.astNode,
            deprecationReason: argConfig.deprecationReason,
            type: replaceType(
              argConfig.type,
              newTypes,
              `${argConfig.name} argument of ${type.name}.${fieldConfig.name}`,
              subGraphs,
            ),
          };
        });

        newFields[fieldName] = {
          description: fieldConfig.description,
          resolve: fieldConfig.resolve,
          subscribe: fieldConfig.subscribe,
          extensions: fieldConfig.extensions,
          astNode: fieldConfig.astNode,
          deprecationReason: fieldConfig.deprecationReason,
          type: replaceType(
            fieldConfig.type,
            newTypes,
            `${type.name}.${fieldConfig.name}`,
            subGraphs,
          ),
          args: newArguments,
        };
      });

      return newFields;
    };
  }

  static mapInputFields(
    type: GraphQLInputObjectType,
    newTypes: Map<string, GraphQLNamedType>,
    subGraphs: string[],
  ) {
    const oldFields = type.getFields();

    return () => {
      const newFields: GraphQLInputFieldConfigMap = {};

      Object.keys(oldFields).forEach((fieldName) => {
        const fieldConfig = oldFields[fieldName];
        const fieldSubGraphs = fieldConfig.extensions?.subGraphs as string[] | undefined;

        if (fieldSubGraphs && !intersect(fieldSubGraphs, subGraphs)) {
          if (isNonNullType(fieldConfig.type)) {
            throw new PothosSchemaError(
              `${type.name}.${fieldName} is NonNull and must be in included in all sub-graphs that include ${type.name}`,
            );
          }

          return;
        }

        newFields[fieldName] = {
          description: fieldConfig.description,
          extensions: fieldConfig.extensions,
          astNode: fieldConfig.astNode,
          defaultValue: fieldConfig.defaultValue,
          deprecationReason: fieldConfig.deprecationReason,
          type: replaceType(
            fieldConfig.type,
            newTypes,
            `${type.name}.${fieldConfig.name}`,
            subGraphs,
          ),
        };
      });

      return newFields;
    };
  }

  override afterBuild(schema: GraphQLSchema) {
    if (this.options.subGraph) {
      return PothosSubGraphPlugin.createSubGraph(schema, this.options.subGraph);
    }

    return schema;
  }

  override onTypeConfig(typeConfig: PothosTypeConfig) {
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        subGraphs:
          typeConfig.pothosOptions.subGraphs ??
          this.builder.options.subGraphs?.defaultForTypes ??
          [],
      },
    };
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    if (fieldConfig.pothosOptions.subGraphs) {
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          subGraphs: fieldConfig.pothosOptions.subGraphs,
        },
      };
    }

    return fieldConfig;
  }

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    const typeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);

    if (typeConfig.graphqlKind !== 'Interface' && typeConfig.graphqlKind !== 'Object') {
      return fieldConfig;
    }

    let subGraphs: Types['SubGraphs'][] = [];

    if (fieldConfig.pothosOptions.subGraphs) {
      subGraphs = fieldConfig.pothosOptions.subGraphs;
    } else if (typeConfig.pothosOptions.defaultSubGraphsForFields) {
      subGraphs = typeConfig.pothosOptions.defaultSubGraphsForFields;
    } else if (this.builder.options.subGraphs?.fieldsInheritFromTypes) {
      subGraphs = (typeConfig.extensions?.subGraphs as Types['SubGraphs'][]) || [];
    } else if (this.builder.options.subGraphs?.defaultForFields) {
      subGraphs = this.builder.options.subGraphs?.defaultForFields;
    }

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        subGraphs,
      },
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosSubGraphPlugin);
