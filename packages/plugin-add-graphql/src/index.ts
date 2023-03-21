import './global-types';
import {
  getNamedType,
  GraphQLEnumType,
  GraphQLInputType,
  GraphQLInterfaceType,
  GraphQLNamedInputType,
  GraphQLNamedOutputType,
  GraphQLObjectType,
  GraphQLOutputType,
  isListType,
  isNonNullType,
} from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  InputFieldRef,
  InputType,
  InputTypeParam,
  OutputType,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import {
  AddGraphQLEnumTypeOptions,
  AddGraphQLInterfaceTypeOptions,
  AddGraphQLObjectTypeOptions,
  EnumValuesWithShape,
} from './types';

const pluginName = 'simpleObjects' as const;

export default pluginName;

export class PothosSimpleObjectsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {}

SchemaBuilder.registerPlugin(pluginName, PothosSimpleObjectsPlugin);

const proto = SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

function resolveOutputTypeRef(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: GraphQLNamedOutputType,
) {
  return type.name as OutputType<SchemaTypes>;
}

function resolveInputTypeRef(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: GraphQLNamedInputType,
) {
  return type.name as InputType<SchemaTypes>;
}

function resolveOutputType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: GraphQLOutputType,
): { type: TypeParam<SchemaTypes>; nullable: boolean } {
  const namedType = getNamedType(type);
  const isNullable = isNonNullType(type) ? false : true;
  const nonNullable = isNonNullType(type) ? type.ofType : type;
  const isList = isListType(nonNullable);
  const typeRef = resolveOutputTypeRef(builder, namedType);

  if (!isList) {
    return {
      type: typeRef,
      nullable: isNullable,
    };
  }

  return {
    type: [typeRef],
    nullable: {
      list: isNullable,
      items: isNonNullType(nonNullable.ofType) ? false : true,
    } as never,
  };
}

function resolveInputType(
  builder: PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  type: GraphQLInputType,
): { type: InputTypeParam<SchemaTypes>; required: boolean } {
  const namedType = getNamedType(type);
  const isNullable = isNonNullType(type) ? false : true;
  const nonNullable = isNonNullType(type) ? type.ofType : type;
  const isList = isListType(nonNullable);
  const typeRef = resolveInputTypeRef(builder, namedType);

  if (!isList) {
    return {
      type: typeRef,
      required: !isNullable,
    };
  }

  return {
    type: [typeRef],
    required: {
      list: !isNullable,
      items: isNonNullType(nonNullable.ofType) ? true : false,
    } as never,
  };
}

proto.addGraphQLObject = function addGraphQLObject<Shape>(
  type: GraphQLObjectType<Shape>,
  { fields, extensions, ...options }: AddGraphQLObjectTypeOptions<SchemaTypes, Shape>,
) {
  const ref = this.objectRef<Shape>(options?.name ?? type.name);

  ref.implement({
    ...options,
    description: type.description ?? undefined,
    isTypeOf: type.isTypeOf as never,
    extensions: { ...type.extensions, ...extensions },
    interfaces: () => type.getInterfaces().map((i) => resolveOutputTypeRef(this, i)) as [],
    fields: (t) => {
      const existingFields = type.getFields();
      const newFields = fields?.(t) ?? {};
      const combinedFields = {} as typeof newFields;

      Object.entries(existingFields).forEach(([fieldName, field]) => {
        if (typeof newFields[fieldName] !== 'undefined') {
          if (newFields[fieldName] !== null) {
            combinedFields[fieldName] = newFields[fieldName];
          }
          return;
        }

        const args: Record<string, InputFieldRef> = {};

        for (const [argName, arg] of Object.entries(field.args)) {
          args[argName] = t.arg({
            ...resolveInputType(this, arg.type),
            description: arg.description ?? undefined,
            deprecationReason: arg.deprecationReason ?? undefined,
            defaultValue: arg.defaultValue,
            extensions: arg.extensions,
          });
        }

        combinedFields[fieldName] = t.field({
          ...resolveOutputType(this, field.type),
          args,
          description: field.description ?? undefined,
          deprecationReason: field.deprecationReason ?? undefined,
          resolve: field.resolve as never,
        });
      });

      return combinedFields as {};
    },
  });

  return ref;
};

proto.addGraphQLInterface = function addGraphQLInterface<Shape = unknown>(
  type: GraphQLInterfaceType,
  { fields, extensions, ...options }: AddGraphQLInterfaceTypeOptions<SchemaTypes, Shape>,
) {
  const ref = this.interfaceRef<Shape>(options?.name ?? type.name);

  ref.implement({
    ...options,
    description: type.description ?? undefined,
    resolveType: type.resolveType as never,
    extensions: { ...type.extensions, ...extensions },
    interfaces: () => type.getInterfaces().map((i) => resolveOutputTypeRef(this, i)) as [],
    fields: (t) => {
      const existingFields = type.getFields();
      const newFields = fields?.(t) ?? {};
      const combinedFields = {} as typeof newFields;

      Object.entries(existingFields).forEach(([fieldName, field]) => {
        if (typeof newFields[fieldName] !== 'undefined') {
          if (newFields[fieldName] !== null) {
            combinedFields[fieldName] = newFields[fieldName];
          }
          return;
        }

        const args: Record<string, InputFieldRef> = {};

        for (const [argName, arg] of Object.entries(field.args)) {
          args[argName] = t.arg({
            ...resolveInputType(this, arg.type),
            description: arg.description ?? undefined,
            deprecationReason: arg.deprecationReason ?? undefined,
            defaultValue: arg.defaultValue,
            extensions: arg.extensions,
          });
        }

        combinedFields[fieldName] = t.field({
          ...resolveOutputType(this, field.type),
          args,
          description: field.description ?? undefined,
          deprecationReason: field.deprecationReason ?? undefined,
          resolve: field.resolve as never,
        });
      });

      return combinedFields as {};
    },
  });

  return ref;
};

proto.addGraphQLEnum = function addGraphQLEnum<Shape extends string | number>(
  type: GraphQLEnumType,
  {
    values,
    extensions,
    ...options
  }: AddGraphQLEnumTypeOptions<SchemaTypes, EnumValuesWithShape<SchemaTypes, Shape>>,
) {
  const newValues = values ?? {};
  const ref = this.enumType<never, EnumValuesWithShape<SchemaTypes, Shape>>(
    (options?.name ?? type.name) as never,
    {
      ...options,
      description: type.description ?? undefined,
      extensions: { ...type.extensions, ...extensions },
      values: newValues,
    },
  );

  return ref;
};
