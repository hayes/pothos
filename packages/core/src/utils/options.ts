import {
  GraphQLObjectType,
  GraphQLObjectTypeConfig,
  GraphQLInterfaceType,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionType,
  GraphQLUnionTypeConfig,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
  GraphQLEnumType,
  GraphQLEnumTypeConfig,
  GraphQLNamedType,
  GraphQLInputObjectType,
  GraphQLInputObjectTypeConfig,
  GraphQLField,
  GraphQLFieldConfig,
} from 'graphql';
import {
  SchemaTypes,
  TypeParam,
  FieldNullability,
  InputFields,
  InputTypeParam,
  FieldRequiredness,
} from '..';

export function getObjectOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.ObjectTypeOptions {
  if (type.name === 'Query' || type.name === 'Mutation' || type.name === 'Subscription') {
    throw new TypeError(
      `Cant get object options for ${type.name}.  use get${type.name}Options instead`,
    );
  }

  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.ObjectTypeOptions;
}

export function getQueryOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.QueryTypeOptions {
  if (type.name !== 'Query') {
    throw new TypeError(`Expected Query type but got ${type.name}`);
  }

  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.QueryTypeOptions;
}

export function getMutationOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.MutationTypeOptions {
  if (type.name !== 'Mutation') {
    throw new TypeError(`Expected Mutation type but got ${type.name}`);
  }

  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.MutationTypeOptions;
}

export function getSubscriptionOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.SubscriptionTypeOptions {
  if (type.name !== 'Subscription') {
    throw new TypeError(`Expected Subscription type but got ${type.name}`);
  }

  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.SubscriptionTypeOptions;
}

export function getInterfaceOptions(
  type: GraphQLInterfaceType | GraphQLInterfaceTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.InterfaceTypeOptions {
  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.InterfaceTypeOptions;
}

export function getUnionOptions(
  type: GraphQLUnionType | GraphQLUnionTypeConfig<unknown, object>,
): GiraphQLSchemaTypes.UnionTypeOptions {
  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.UnionTypeOptions;
}

export function getScalarOptions(
  type: GraphQLScalarType | GraphQLScalarTypeConfig<unknown, unknown>,
): GiraphQLSchemaTypes.ScalarTypeOptions {
  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.ScalarTypeOptions;
}

export function getEnumOptions(
  type: GraphQLEnumType | GraphQLEnumTypeConfig,
): GiraphQLSchemaTypes.EnumTypeOptions {
  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.EnumTypeOptions;
}

export function getInputObjectOptions(
  type: GraphQLInputObjectType | GraphQLInputObjectTypeConfig,
): GiraphQLSchemaTypes.InputTypeOptions {
  const options = type.extensions && type.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql options for ${type.name}`);
  }

  return options as GiraphQLSchemaTypes.InputTypeOptions;
}

export function getTypeOptions(type: GraphQLNamedType) {
  if (type instanceof GraphQLInputObjectType) {
    return getInputObjectOptions(type);
  }

  if (type instanceof GraphQLEnumType) {
    return getEnumOptions(type);
  }

  if (type instanceof GraphQLScalarType) {
    return getScalarOptions(type);
  }

  if (type instanceof GraphQLUnionType) {
    return getUnionOptions(type);
  }

  if (type instanceof GraphQLInterfaceType) {
    return getInterfaceOptions(type);
  }

  if (type.name === 'Query') {
    return getQueryOptions(type);
  }

  if (type.name === 'Mutation') {
    return getMutationOptions(type);
  }

  if (type.name === 'Subscription') {
    return getSubscriptionOptions(type);
  }

  return getObjectOptions(type);
}

export function getOutputTypeWithFieldOptions(type: GraphQLObjectType | GraphQLInterfaceType) {
  if (type instanceof GraphQLInterfaceType) {
    return getInterfaceOptions(type);
  }

  if (type.name === 'Query') {
    return getQueryOptions(type);
  }

  if (type.name === 'Mutation') {
    return getMutationOptions(type);
  }

  if (type.name === 'Subscription') {
    return getSubscriptionOptions(type);
  }

  return getObjectOptions(type);
}

export function getObjectFieldOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.ObjectFieldOptions<
  SchemaTypes,
  unknown,
  TypeParam<SchemaTypes>,
  FieldNullability,
  InputFields,
  unknown
> {
  if (type.name === 'Query' || type.name === 'Mutation' || type.name === 'Subscription') {
    throw new TypeError(
      `Cant get object field options for ${type.name}.  use get${type.name}FieldOptions instead`,
    );
  }

  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.ObjectFieldOptions<
    SchemaTypes,
    unknown,
    TypeParam<SchemaTypes>,
    FieldNullability,
    InputFields,
    unknown
  >;
}

export function getQueryFieldOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.QueryFieldOptions<
  SchemaTypes,
  TypeParam<SchemaTypes>,
  FieldNullability,
  InputFields,
  unknown
> {
  if (type.name !== 'Query') {
    throw new TypeError(`Expected Query type but got ${type.name}`);
  }

  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.QueryFieldOptions<
    SchemaTypes,
    TypeParam<SchemaTypes>,
    FieldNullability,
    InputFields,
    unknown
  >;
}

export function getMutationFieldOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.MutationFieldOptions<
  SchemaTypes,
  TypeParam<SchemaTypes>,
  FieldNullability,
  InputFields,
  unknown
> {
  if (type.name !== 'Mutation') {
    throw new TypeError(`Expected Mutation type but got ${type.name}`);
  }

  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.MutationFieldOptions<
    SchemaTypes,
    TypeParam<SchemaTypes>,
    FieldNullability,
    InputFields,
    unknown
  >;
}

export function getSubscriptionFieldOptions(
  type: GraphQLObjectType | GraphQLObjectTypeConfig<unknown, object>,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.SubscriptionFieldOptions<
  SchemaTypes,
  TypeParam<SchemaTypes>,
  FieldNullability,
  InputFields,
  unknown,
  unknown
> {
  if (type.name !== 'Subscription') {
    throw new TypeError(`Expected Subscription type but got ${type.name}`);
  }

  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.SubscriptionFieldOptions<
    SchemaTypes,
    TypeParam<SchemaTypes>,
    FieldNullability,
    InputFields,
    unknown,
    unknown
  >;
}

export function getInterfaceFieldOptions(
  type: GraphQLInterfaceType | GraphQLInterfaceTypeConfig<unknown, object>,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.InterfaceFieldOptions<
  SchemaTypes,
  unknown,
  TypeParam<SchemaTypes>,
  FieldNullability,
  InputFields,
  unknown
> {
  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.InterfaceFieldOptions<
    SchemaTypes,
    unknown,
    TypeParam<SchemaTypes>,
    FieldNullability,
    InputFields,
    unknown
  >;
}

export function getInputFieldOptions(
  type: GraphQLInputObjectType | GraphQLInputObjectTypeConfig,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
): GiraphQLSchemaTypes.InputOptions<SchemaTypes, InputTypeParam<SchemaTypes>, FieldRequiredness> {
  const options = field.extensions && field.extensions.giraphqlOptions;

  if (!options) {
    throw new Error(`Missing giraphql input field options for ${type.name}.${name}`);
  }

  return options as GiraphQLSchemaTypes.InputOptions<
    SchemaTypes,
    InputTypeParam<SchemaTypes>,
    FieldRequiredness
  >;
}

export function getOutputFieldOptions(
  type: GraphQLObjectType | GraphQLInterfaceType,
  field: GraphQLField<unknown, object> | GraphQLFieldConfig<unknown, object>,
  name: string,
) {
  if (type instanceof GraphQLInterfaceType) {
    return getInterfaceFieldOptions(type, field, name);
  }

  if (type.name === 'Query') {
    return getQueryFieldOptions(type, field, name);
  }

  if (type.name === 'Mutation') {
    return getMutationFieldOptions(type, field, name);
  }

  if (type.name === 'Subscription') {
    return getSubscriptionFieldOptions(type, field, name);
  }

  return getObjectFieldOptions(type, field, name);
}
