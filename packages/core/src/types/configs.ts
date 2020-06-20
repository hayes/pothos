import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLInputObjectType,
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLScalarTypeConfig,
  GraphQLInputObjectTypeConfig,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
} from 'graphql';
import {
  SchemaTypes,
  ObjectParam,
  OutputType,
  InputType,
  FieldNullability,
  InputFieldMap,
  TypeParam,
  FieldRequiredness,
  InputTypeParam,
} from '..';

export interface GiraphQLQueryTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Query';
  giraphqlOptions: GiraphQLSchemaTypes.QueryTypeOptions;
}
export interface GiraphQLMutationTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Mutation';
  giraphqlOptions: GiraphQLSchemaTypes.MutationTypeOptions;
}

export interface GiraphQLSubscriptionTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Subscription';
  giraphqlOptions: GiraphQLSchemaTypes.SubscriptionTypeOptions;
}

export interface GiraphQLObjectTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Object';
  interfaces: ObjectParam<SchemaTypes>[];
  giraphqlOptions: GiraphQLSchemaTypes.ObjectTypeOptions;
}

export interface GiraphQLInterfaceTypeConfig
  extends Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields'> {
  kind: 'Interface';
  giraphqlOptions: GiraphQLSchemaTypes.InterfaceTypeOptions;
}

export interface GiraphQLUnionTypeConfig
  extends Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'> {
  kind: 'Union';
  types: ObjectParam<SchemaTypes>[];
  giraphqlOptions: GiraphQLSchemaTypes.UnionTypeOptions;
}

export interface GiraphQLEnumTypeConfig extends GraphQLEnumTypeConfig {
  kind: 'Enum';
  giraphqlOptions: GiraphQLSchemaTypes.EnumTypeOptions;
}

export interface GiraphQLScalarTypeConfig extends GraphQLScalarTypeConfig<unknown, unknown> {
  kind: 'Scalar';
  giraphqlOptions: GiraphQLSchemaTypes.ScalarTypeOptions;
}

export interface GiraphQLInputObjectTypeConfig
  extends Omit<GraphQLInputObjectTypeConfig, 'fields'> {
  kind: 'InputObject';
  giraphqlOptions: GiraphQLSchemaTypes.InputObjectTypeOptions;
}

export type GiraphQLTypeConfig =
  | GiraphQLQueryTypeConfig
  | GiraphQLMutationTypeConfig
  | GiraphQLSubscriptionTypeConfig
  | GiraphQLObjectTypeConfig
  | GiraphQLInterfaceTypeConfig
  | GiraphQLUnionTypeConfig
  | GiraphQLEnumTypeConfig
  | GiraphQLScalarTypeConfig
  | GiraphQLInputObjectTypeConfig;

export type GiraphQLTypeKind = GiraphQLTypeConfig['kind'];

export type GiraphQLKindToGraphQLType<T extends GiraphQLTypeKind> = {
  Object: GraphQLObjectType;
  Query: GraphQLObjectType;
  Mutation: GraphQLObjectType;
  Subscription: GraphQLObjectType;
  Interface: GraphQLInterfaceType;
  Union: GraphQLUnionType;
  Enum: GraphQLEnumType;
  Scalar: GraphQLScalarType;
  InputObject: GraphQLInputObjectType;
}[T];

export interface GiraphQLObjectFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLFieldConfig<unknown, object>, 'type'> {
  kind: 'ObjectField';
  type: GiraphQLOutputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.ObjectFieldOptions<
    Types,
    unknown,
    TypeParam<Types>,
    FieldNullability<[unknown]>,
    InputFieldMap,
    unknown
  >;
}

export interface GiraphQLQueryFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLFieldConfig<unknown, object>, 'type'> {
  kind: 'QueryField';
  type: GiraphQLOutputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.QueryFieldOptions<
    Types,
    TypeParam<Types>,
    FieldNullability<[unknown]>,
    InputFieldMap,
    unknown
  >;
}

export interface GiraphQLMutationFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLFieldConfig<unknown, object>, 'type'> {
  kind: 'MutationField';
  type: GiraphQLOutputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.MutationFieldOptions<
    Types,
    TypeParam<Types>,
    FieldNullability<[unknown]>,
    InputFieldMap,
    unknown
  >;
}

export interface GiraphQLSubscriptionFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLFieldConfig<unknown, object>, 'type'> {
  kind: 'SubscriptionField';
  type: GiraphQLOutputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.SubscriptionFieldOptions<
    Types,
    TypeParam<Types>,
    FieldNullability<[unknown]>,
    InputFieldMap,
    unknown,
    unknown
  >;
}

export interface GiraphQLInterfaceFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLFieldConfig<unknown, object>, 'type'> {
  kind: 'InterfaceField';
  type: GiraphQLOutputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.InterfaceFieldOptions<
    Types,
    unknown,
    TypeParam<Types>,
    FieldNullability<[unknown]>,
    InputFieldMap,
    unknown
  >;
}

export interface GiraphQLInputFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLInputFieldConfig, 'type'> {
  kind: 'InputField';
  type: GiraphQLInputFieldConfig<Types>;
  options: GiraphQLSchemaTypes.InputFieldOptions<
    Types,
    InputTypeParam<Types>,
    FieldRequiredness<[unknown]>
  >;
}

export type GiraphQLFieldConfig<Types extends SchemaTypes> =
  | GiraphQLObjectFieldConfig<Types>
  | GiraphQLQueryFieldConfig<Types>
  | GiraphQLMutationFieldConfig<Types>
  | GiraphQLSubscriptionFieldConfig<Types>
  | GiraphQLInterfaceFieldConfig<Types>
  | GiraphQLInputFieldConfig<Types>;

export type GiraphQLOutputFieldConfig<Types extends SchemaTypes> = Exclude<
  GiraphQLFieldConfig<Types>,
  { kind: 'InputField' }
>;

export type GiraphQLFieldKind = GiraphQLTypeConfig['kind'];

export type GiraphQLOutputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'Object' | 'Interface' | 'Union' | 'Enum' | 'Scalar';
      ref: OutputType<Types>;
      nullable: boolean;
    }
  | {
      kind: 'List';
      type: Exclude<GiraphQLFieldKind, { kind: 'List' }>;
      nullable: boolean;
    };

export type GiraphQLInputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'InputObject' | 'Enum' | 'Scalar';
      ref: InputType<Types>;
      required: boolean;
    }
  | {
      kind: 'List';
      type: Exclude<GiraphQLFieldKind, { kind: 'List' }>;
      required: boolean;
    };
