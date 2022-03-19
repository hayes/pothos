import { GraphQLSchema, isObjectType } from 'graphql';
import { applyMiddleware } from 'graphql-middleware';
import { IRules, shield } from 'graphql-shield';
import { ShieldRule } from 'graphql-shield/dist/types';
import SchemaBuilder, {
  BasePlugin,
  FieldNullability,
  InputFieldMap,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';

/* eslint-disable @typescript-eslint/no-unused-vars */

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      shield?: ShieldPlugin<Types>;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      shield?: ShieldRule;
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      shield?: ShieldRule;
    }

    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      shield: ShieldRule;
    }

    export interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      shield: ShieldRule;
    }
  }
}

const pluginName = 'shield' as const;

export default pluginName;

export class ShieldPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const types = schema.getTypeMap();

    const rules: IRules = {};

    Object.keys(types).forEach((typeName) => {
      const type = types[typeName];
      if (!isObjectType(type)) {
        return;
      }

      const rule = (
        (type.extensions?.pothosOptions ?? {}) as PothosSchemaTypes.ObjectTypeOptions<
          SchemaTypes,
          {}
        >
      ).shield;

      const ruleMap: Record<string, ShieldRule> = rule
        ? {
            '*': rule,
          }
        : {};

      rules[typeName] = ruleMap;

      const fields = type.getFields();

      Object.keys(fields).forEach((fieldName) => {
        const field = fields[fieldName];

        const { shield: fieldRule } = (field.extensions?.pothosOptions ?? {}) as {
          shield?: ShieldRule;
        };

        if (fieldRule) {
          ruleMap[fieldName] = fieldRule;
        }
      });
    });

    return applyMiddleware(schema, shield(rules));
  }
}

SchemaBuilder.registerPlugin(pluginName, ShieldPlugin);
