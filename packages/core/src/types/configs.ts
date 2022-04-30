import {
  GraphQLEnumType,
  GraphQLEnumTypeConfig,
  GraphQLEnumValueConfig,
  GraphQLFieldConfig,
  GraphQLInputFieldConfig,
  GraphQLInputObjectType,
  GraphQLInputObjectTypeConfig,
  GraphQLInterfaceType,
  GraphQLInterfaceTypeConfig,
  GraphQLObjectType,
  GraphQLObjectTypeConfig,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
  GraphQLUnionType,
  GraphQLUnionTypeConfig,
} from 'graphql';
import { FieldKind, FieldOptionsFromKind, InputFieldMap } from './builder-options';
import { SchemaTypes } from './schema-types';
import {
  FieldNullability,
  FieldRequiredness,
  InputType,
  InputTypeParam,
  InterfaceParam,
  ObjectParam,
  OutputType,
  TypeParam,
} from './type-params';
import { Merge } from './utils';

export interface PothosQueryTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Query';
  graphqlKind: 'Object';
  pothosOptions: PothosSchemaTypes.QueryTypeOptions;
}
export interface PothosMutationTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Mutation';
  graphqlKind: 'Object';
  pothosOptions: PothosSchemaTypes.MutationTypeOptions;
}

export interface PothosSubscriptionTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Subscription';
  graphqlKind: 'Object';
  pothosOptions: PothosSchemaTypes.SubscriptionTypeOptions;
}

export interface PothosObjectTypeConfig
  extends Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Object';
  graphqlKind: 'Object';
  interfaces: InterfaceParam<SchemaTypes>[];
  pothosOptions: PothosSchemaTypes.ObjectTypeOptions;
}

export interface PothosInterfaceTypeConfig
  extends Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields' | 'interfaces'> {
  kind: 'Interface';
  graphqlKind: 'Interface';
  interfaces: InterfaceParam<SchemaTypes>[];
  pothosOptions: PothosSchemaTypes.InterfaceTypeOptions;
}

export interface PothosUnionTypeConfig
  extends Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'> {
  kind: 'Union';
  graphqlKind: 'Union';
  types: ObjectParam<SchemaTypes>[];
  pothosOptions: PothosSchemaTypes.UnionTypeOptions;
}

export interface PothosEnumTypeConfig extends GraphQLEnumTypeConfig {
  kind: 'Enum';
  graphqlKind: 'Enum';
  pothosOptions: PothosSchemaTypes.EnumTypeOptions;
}

export interface PothosScalarTypeConfig extends GraphQLScalarTypeConfig<unknown, unknown> {
  kind: 'Scalar';
  graphqlKind: 'Scalar';
  pothosOptions: PothosSchemaTypes.ScalarTypeOptions;
}

export interface PothosInputObjectTypeConfig extends Omit<GraphQLInputObjectTypeConfig, 'fields'> {
  kind: 'InputObject';
  graphqlKind: 'InputObject';
  pothosOptions: PothosSchemaTypes.InputObjectTypeOptions;
}

export type PothosTypeConfig =
  | PothosEnumTypeConfig
  | PothosInputObjectTypeConfig
  | PothosInterfaceTypeConfig
  | PothosMutationTypeConfig
  | PothosObjectTypeConfig
  | PothosQueryTypeConfig
  | PothosScalarTypeConfig
  | PothosSubscriptionTypeConfig
  | PothosUnionTypeConfig;

export type PothosTypeKind = PothosTypeConfig['kind'];

export type PothosKindToGraphQLTypeClass<T extends PothosTypeKind> = {
  Object: GraphQLObjectType;
  Interface: GraphQLInterfaceType;
  Union: GraphQLUnionType;
  Enum: GraphQLEnumType;
  Scalar: GraphQLScalarType;
  InputObject: GraphQLInputObjectType;
}[PothosSchemaTypes.PothosKindToGraphQLType[T]];

export type PothosFieldKindToConfig<Types extends SchemaTypes, Kind extends FieldKind> = {
  [K in FieldKind]: Merge<
    Omit<GraphQLFieldConfig<unknown, object>, 'args' | 'type'> & {
      kind: K;
      graphqlKind: PothosSchemaTypes.PothosKindToGraphQLType[K];
      parentType: string;
      name: string;
      type: PothosOutputFieldType<Types>;
      args: Record<string, PothosInputFieldConfig<Types>>;
      pothosOptions: FieldOptionsFromKind<
        Types,
        unknown,
        TypeParam<Types>,
        FieldNullability<[unknown]>,
        InputFieldMap,
        K,
        unknown,
        unknown
      >;
    }
  >;
}[Kind];

export interface PothosInputFieldConfig<Types extends SchemaTypes>
  extends Omit<GraphQLInputFieldConfig, 'type'> {
  kind: 'Arg' | 'InputObject';
  graphqlKind: 'Arg' | 'InputObject';
  name: string;
  parentField: string | undefined;
  parentType: string;
  type: PothosInputFieldType<Types>;
  pothosOptions: PothosSchemaTypes.InputFieldOptionsByKind<
    Types,
    InputTypeParam<Types>,
    FieldRequiredness<[unknown]>
  >[keyof PothosSchemaTypes.InputFieldOptionsByKind];
}

export interface PothosEnumValueConfig<Types extends SchemaTypes> extends GraphQLEnumValueConfig {
  pothosOptions: PothosSchemaTypes.EnumValueConfig<Types>;
}

export type PothosOutputFieldConfig<Types extends SchemaTypes> = PothosFieldKindToConfig<
  Types,
  FieldKind
>;

export type PothosFieldConfig<Types extends SchemaTypes> =
  | PothosInputFieldConfig<Types>
  | PothosOutputFieldConfig<Types>;

export type GraphQLFieldKind = PothosFieldConfig<SchemaTypes>['graphqlKind'];

export type PothosOutputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'Enum' | 'Interface' | 'Object' | 'Scalar' | 'Union';
      ref: OutputType<Types>;
      nullable: boolean;
    }
  | {
      kind: 'List';
      type: PothosNameOutputFieldType<Types>;
      nullable: boolean;
    };
export type PothosNameOutputFieldType<Types extends SchemaTypes> = Exclude<
  PothosOutputFieldType<Types>,
  { kind: 'List' }
>;

export type PothosInputFieldType<Types extends SchemaTypes> =
  | {
      kind: 'Enum' | 'InputObject' | 'Scalar';
      ref: InputType<Types>;
      required: boolean;
    }
  | {
      kind: 'List';
      type: PothosNameInputFieldType<Types>;
      required: boolean;
    };

export type PothosNameInputFieldType<Types extends SchemaTypes> = Exclude<
  PothosInputFieldType<Types>,
  { kind: 'List' }
>;
