/* eslint-disable no-dupe-class-members */
import { GraphQLSchema, GraphQLScalarType, GraphQLDirective } from 'graphql';
import {
  ImplementedType,
  EnumValues,
  InputFields,
  InputShapeFromFields,
  ObjectName,
  InterfaceName,
  ScalarName,
  FieldsShape,
  RootFieldsShape,
  ResolverMap,
  ShapeFromTypeParam,
  CompatibleInterfaceParam,
  TypeParam,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import BasePlugin from './plugin';
import BuildCache from './build-cache';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';
import { InputFieldBuilder } from '.';

export default class SchemaBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  private plugins: BasePlugin[];

  private types: ImplementedType[] = [];

  private fields: (FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types>)[] = [];

  constructor(options: { plugins?: BasePlugin[] } = {}) {
    this.plugins = options.plugins ?? [];
  }

  objectType<
    Interfaces extends CompatibleInterfaceParam<Types, ShapeFromTypeParam<Types, Type, false>>[],
    Type extends ObjectName<Types>
  >(
    name: Type,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, ShapeFromTypeParam<Types, Type, false>>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
          Types,
          ShapeFromTypeParam<Types, Type, false>,
          Interfaces
        >,
    shape?: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Object'>,
  ) {
    if (shape) {
      this.addFields(new FieldSet<Types, Type>(name, shape));
    }

    return this.addType(
      new ObjectType<Types>(
        name,
        options as GiraphQLSchemaTypes.ObjectTypeOptions<
          Types,
          ShapeFromTypeParam<Types, Type, false>
        >,
      ),
    );
  }

  objectFields<Type extends ObjectName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Object'>,
  ) {
    return this.addFields(new FieldSet<Types, Type>(name, shape));
  }

  queryType(
    options: GiraphQLSchemaTypes.QueryTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Query'>,
  ) {
    if (shape) {
      this.addFields(new RootFieldSet('Query', shape));
    }

    return this.addType(new RootType<Types, 'Query'>('Query', options));
  }

  queryFields(shape: RootFieldsShape<Types, 'Query'>) {
    return this.addFields(new RootFieldSet('Query', shape));
  }

  mutationType(
    options: GiraphQLSchemaTypes.MutationTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Mutation'>,
  ) {
    if (shape) {
      this.addFields(new RootFieldSet('Mutation', shape));
    }

    return this.addType(new RootType<Types, 'Mutation'>('Mutation', options));
  }

  mutationFields(shape: RootFieldsShape<Types, 'Mutation'>) {
    return this.addFields(new RootFieldSet('Mutation', shape));
  }

  subscriptionType(
    options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Subscription'>,
  ) {
    if (shape) {
      this.addFields(new RootFieldSet('Subscription', shape));
    }

    return this.addType(new RootType<Types, 'Subscription'>('Subscription', options));
  }

  subscriptionFields(shape: RootFieldsShape<Types, 'Subscription'>) {
    return this.addFields(new RootFieldSet('Subscription', shape));
  }

  args<Shape extends InputFields<Types>>(
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<
      Types,
      ShapeFromTypeParam<Types, Type, false>
    >,
    shape?: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Interface'>,
  ) {
    if (shape) {
      this.addFields(new FieldSet(name, shape));
    }

    return this.addType(new InterfaceType<Types, Type>(name, options));
  }

  interfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>, 'Interface'>,
  ) {
    return this.addFields(new FieldSet(name, shape));
  }

  unionType<Member extends ObjectName<Types>, Name extends string>(
    name: Name,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    return this.addType(new UnionType<Types, Member>(name, options));
  }

  enumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    return this.addType(new EnumType(name, options));
  }

  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.ScalarOptions<
      Types['Scalar'][Name]['Input'],
      Types['Scalar'][Name]['Output']
    >,
  ) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(
        name,
        options,
      ),
    );
  }

  addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(name, {
        name,
        description: scalar.description ?? undefined,
        serialize: scalar.serialize,
        parseLiteral: scalar.parseLiteral,
        parseValue: scalar.parseValue,
        extensions: scalar.extensions ?? undefined,
      }),
    );
  }

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: Omit<GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>, 'shape'>,
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
    shape?: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name> {
    if (shape && options.shape) {
      throw new Error(`Received multiple field shape functions for InputObjectType ${name}`);
    }

    return this.addType(
      new InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>(name, {
        ...options,
        shape: shape || options.shape,
      }),
    );
  }

  // Temporarily alias old names for compatibility
  createQueryType = this.queryType;

  createMutationType = this.mutationType;

  createSubscriptionType = this.subscriptionType;

  createObjectType = this.objectType;

  createInterfaceType = this.interfaceType;

  createQueryFields = this.queryFields;

  createMutationFields = this.mutationFields;

  createSubscriptionFields = this.subscriptionFields;

  createObjectFields = this.objectFields;

  createInterfaceFields = this.interfaceFields;

  createUnionType = this.unionType;

  createEnumType = this.enumType;

  createScalarType = this.addScalarType;

  createInputType = this.inputType;

  createArgs = this.args;

  toSchema({
    directives,
    extensions,
    mocks,
  }: {
    directives?: readonly GraphQLDirective[];
    extensions?: Record<string, unknown>;
    mocks?: ResolverMap;
  } = {}) {
    const buildCache = new BuildCache([...this.types], {
      plugins: this.plugins,
      fieldDefinitions: [...this.fields],
      mocks,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()].map(entry => entry.built);

    const schema = new GraphQLSchema({
      query: buildCache.has('Query') ? buildCache.getEntryOfType('Query', 'Root').built : undefined,
      mutation: buildCache.has('Mutation')
        ? buildCache.getEntryOfType('Mutation', 'Root').built
        : undefined,
      subscription: buildCache.has('Subscription')
        ? buildCache.getEntryOfType('Subscription', 'Root').built
        : undefined,
      extensions,
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    return schema;
  }

  private addType<T extends ImplementedType>(type: T) {
    this.types.push(type);

    return type;
  }

  private addFields<T extends FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types>>(fields: T) {
    this.fields.push(fields);

    return fields;
  }
}
